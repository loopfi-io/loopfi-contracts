// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "./interfaces/velodrome/IBaseV1Voter.sol";
import "./interfaces/velodrome/IGauge.sol";
import "./interfaces/velodrome/IBribe.sol";
import "./interfaces/velodrome/IVotingEscrow.sol";
import "./interfaces/loopfi/ILoopfiToken.sol";
import "./interfaces/loopfi/ILpDepositToken.sol";
import "./interfaces/loopfi/IVeDepositor.sol";
import "./interfaces/loopfi/IGaugeRewardPool.sol";
import "./interfaces/loopfi/ITreasury.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";


contract LpDepositor is Initializable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    // velo contracts
    IERC20Upgradeable public VELO;
    IVotingEscrow public votingEscrow;
    IBaseV1Voter public veloVoter;

    // loopfi contracts
    ILoopfiToken public LPF;
    IVeDepositor public pVELO;
    ITreasury public treasury;
    address public stakingRewards;
    address public depositTokenImplementation;
    address public teamRewards;
    address public investorsRewards;

    uint256 public tokenID;

    struct Amounts {
        uint256 velo;
        uint256 lpf;
    }

    // pool -> gauge
    mapping(address => address) public gaugeForPool;
    // pool -> external bribe
    mapping(address => address) public bribeForPool;
    // pool -> internal bribe
    mapping(address => address) public internalBribeForPool;
    // pool -> loopfi deposit token
    mapping(address => address) public tokenForPool;
    // user -> pool -> deposit amount
    mapping(address => mapping(address => uint256)) public userBalances;
    // pool -> total deposit amount
    mapping(address => uint256) public totalBalances;
    // pool -> integrals
    mapping(address => Amounts) public rewardIntegral;
    // user -> pool -> integrals

    mapping(address => mapping(address => Amounts)) public rewardIntegralFor;
    // user -> pool -> claimable

    mapping(address => mapping(address => Amounts)) claimable;

    // internal accounting to track VELO fees for pVELO stakers and LPF lockers

    uint256 public unclaimedSolidBonus;

    // pool -> extra reward
    mapping(address => address) public extraRewardForPool;

    event RewardAdded(address indexed rewardsToken, uint256 reward);
    event Deposited(address indexed user, address indexed pool, uint256 amount);
    event Withdrawn(address indexed user, address indexed pool, uint256 amount);
    event RewardPaid(address indexed user, address indexed rewardsToken, uint256 reward);
    event TransferDeposit(address indexed pool, address indexed from, address indexed to, uint256 amount);


    function initialize(
        IERC20Upgradeable _velo,
        IVotingEscrow _votingEscrow,
        IBaseV1Voter _veloVoter
    ) public initializer {
        __Ownable_init();


        VELO = _velo;
        votingEscrow = _votingEscrow;
        veloVoter = _veloVoter;
    }

    /**
     * @dev Check whether a pool is listed.
     * @param _pool The pool to check for.
     * @return true if the pool is listed otherwise false.
     */
    function hasExtra(address _pool) public view returns (bool) {
        return extraRewardForPool[_pool] != address(0);
    }

    /**
     * @dev Add extra reward for pool.
     * @param _pool The pool to add extra reward.
     * @param _reward The corresponding reward contract for the pool.
     */
    function addExtraReward(address _pool, address _reward) external onlyOwner {
        require(!hasExtra(_pool), "Pool has already been listed");

        extraRewardForPool[_pool] = _reward;
    }

    /**
     * @dev Remove pool to get extra reward.
     * @param _pool The pool to remove extra reward.
     */
    function clearExtraReward(address _pool) external onlyOwner {
        if (hasExtra(_pool)) {
            delete extraRewardForPool[_pool];
        }
    }


    function setAddresses(
        ILoopfiToken _lpf,
        IVeDepositor _pVELO,
        address _loopfiVoter,
        ITreasury _treasury,
        address _stakingRewards,
        address _depositToken,
        address _teamRewards,
        address _investorsRewards
    ) external onlyOwner {
        LPF = _lpf;
        pVELO = _pVELO;
        treasury = _treasury;
        stakingRewards = _stakingRewards;
        depositTokenImplementation = _depositToken;
        teamRewards = _teamRewards;
        investorsRewards = _investorsRewards;

        VELO.approve(address(_pVELO), type(uint256).max);
        _pVELO.approve(address(_treasury), type(uint256).max);
        votingEscrow.setApprovalForAll(_loopfiVoter, true);
        votingEscrow.setApprovalForAll(address(_pVELO), true);
    }

    /**
        @notice Get pending VELO and LPF rewards earned by `account`
        @param account Account to query pending rewards for
        @param pools List of pool addresses to query rewards for
        @return pending Array of tuples of (VELO rewards, LPF rewards) for each item in `pool`
     */
    function pendingRewards(
        address account,
        address[] calldata pools
    )
        external
        view
        returns (Amounts[] memory pending)
    {
        pending = new Amounts[](pools.length);
        for (uint256 i = 0; i < pools.length; i++) {
            address pool = pools[i];
            pending[i] = claimable[account][pool];

            uint256 balance = userBalances[account][pool];
            if (balance == 0) continue;


            Amounts memory integral = rewardIntegral[pool];

            uint256 total = totalBalances[pool];
            if (total > 0) {

                uint256 delta = IGauge(gaugeForPool[pool]).earned(address(VELO), address(this));

                delta -= delta * 15 / 100;

                integral.velo += 1e18 * delta / total;

                integral.lpf += 1e18 * (delta * 10000 / 42069) / total;
            }


            Amounts storage integralFor = rewardIntegralFor[account][pool];
            if (integralFor.velo < integral.velo) {
                pending[i].velo += balance * (integral.velo - integralFor.velo) / 1e18;
                pending[i].lpf += balance * (integral.lpf - integralFor.lpf) / 1e18;
            }
        }
        return pending;
    }

    /**
        @notice Deposit VELO LP tokens into a gauge via this contract
        @dev Each deposit is also represented via a new ERC20, the address
             is available by querying `tokenForPool(pool)`
        @param pool Address of the pool token to deposit
        @param amount Quantity of tokens to deposit
     */
    function deposit(address pool, uint256 amount) external {
        require(tokenID != 0, "Must lock VELO first");
        require(amount > 0, "Cannot deposit zero");


        address gauge = gaugeForPool[pool];

        uint256 total = totalBalances[pool];

        uint256 balance = userBalances[msg.sender][pool];


        if (gauge == address(0)) {

            gauge = veloVoter.gauges(pool);

            if (gauge == address(0)) {
                gauge = veloVoter.createGauge(pool);
            }

            gaugeForPool[pool] = gauge;
            bribeForPool[pool] = veloVoter.external_bribes(gauge);
            internalBribeForPool[pool] = veloVoter.internal_bribes(gauge);

            tokenForPool[pool] = _deployDepositToken(pool);
            IERC20Upgradeable(pool).approve(gauge, type(uint256).max);
        } else {

            _updateIntegrals(msg.sender, pool, gauge, balance, total);
        }

        IERC20Upgradeable(pool).transferFrom(msg.sender, address(this), amount);
        IGauge(gauge).deposit(amount, tokenID);

        // Also stake to linked rewards
        if (hasExtra(pool)) {
            IGaugeRewardPool(extraRewardForPool[pool]).stake(msg.sender, amount);
        }

        userBalances[msg.sender][pool] = balance + amount;
        totalBalances[pool] = total + amount;

        IDepositToken(tokenForPool[pool]).mint(msg.sender, amount);
        emit Deposited(msg.sender, pool, amount);
    }

    /**
        @notice Withdraw VELO LP tokens
        @param pool Address of the pool token to withdraw
        @param amount Quantity of tokens to withdraw
     */
    function withdraw(address pool, uint256 amount) external {
        address gauge = gaugeForPool[pool];

        uint256 total = totalBalances[pool];
        uint256 balance = userBalances[msg.sender][pool];

        require(gauge != address(0), "Unknown pool");
        require(amount > 0, "Cannot withdraw zero");
        require(balance >= amount, "Insufficient deposit");


        _updateIntegrals(msg.sender, pool, gauge, balance, total);

        userBalances[msg.sender][pool] = balance - amount;
        totalBalances[pool] = total - amount;

        IDepositToken(tokenForPool[pool]).burn(msg.sender, amount);

        // Also withdraw from linked rewards.
        if (hasExtra(pool)) {
            IGaugeRewardPool(extraRewardForPool[pool]).withdraw(msg.sender, amount);
        }

        IGauge(gauge).withdraw(amount);
        IERC20Upgradeable(pool).transfer(msg.sender, amount);
        emit Withdrawn(msg.sender, pool, amount);
    }

    /**
        @notice Claim VELO and LPF rewards earned from depositing LP tokens
        @dev An additional 5% of LPF is also minted for `StakingRewards`
        @param pools List of pools to claim for
     */

    function getReward(address[] calldata pools) external {
        Amounts memory claims;
        for (uint256 i = 0; i < pools.length; i++) {

            address pool = pools[i];
            address gauge = gaugeForPool[pool];
            uint256 total = totalBalances[pool];
            uint256 balance = userBalances[msg.sender][pool];

            _updateIntegrals(msg.sender, pool, gauge, balance, total);

            claims.velo += claimable[msg.sender][pool].velo;
            claims.lpf += claimable[msg.sender][pool].lpf;
            delete claimable[msg.sender][pool];

            // Also get rewards from linked rewards
            if (hasExtra(pool)) {
                IGaugeRewardPool(extraRewardForPool[pool]).getReward(msg.sender);
            }
        }

        if (claims.velo > 0) {
            VELO.transfer(msg.sender, claims.velo);
            emit RewardPaid(msg.sender, address(VELO), claims.velo);
        }
    }

    /**
        @notice Claim incentive tokens from gauge and/or bribe contracts
                and transfer them to `Treasury`
        @dev This method is unguarded, anyone can claim any reward at any time.
             Claimed tokens are streamed to LPF lockers starting at the beginning
             of the following epoch week.
        @param pool Address of the pool token to claim for
        @param gaugeRewards List of incentive tokens to claim for in the pool's gauge
        @param bribeRewards List of incentive tokens to claim for in the pool's bribe contract
     */
    function claimLockerRewards(
        address pool,
        address[] calldata gaugeRewards,
        address[] calldata bribeRewards
    ) external {
        // claim pending gauge rewards for this pool to update `unclaimedSolidBonus`
        address gauge = gaugeForPool[pool];
        require(gauge != address(0), "Unknown pool");

        _updateIntegrals(address(0), pool, gauge, 0, totalBalances[pool]);

        address distributor = address(treasury);
        uint256 amount;

        // fetch gauge rewards and push to the fee distributor
        if (gaugeRewards.length > 0) {
            // Get rewards.
            IGauge(gauge).getReward(address(this), gaugeRewards);
            for (uint i = 0; i < gaugeRewards.length; i++) {

                IERC20Upgradeable reward = IERC20Upgradeable(gaugeRewards[i]);
                require(reward != VELO, "!VELO as gauge reward");

                amount = IERC20Upgradeable(reward).balanceOf(address(this));
                if (amount == 0) continue;

                if (reward.allowance(address(this), distributor) == 0) {
                    reward.safeApprove(distributor, type(uint256).max);
                }

                ITreasury(distributor).depositFee(address(reward), amount);

            }
        }

        // fetch bribe rewards and push to the fee distributor
        if (bribeRewards.length > 0) {

            uint256 veloBalance = VELO.balanceOf(address(this));

            IBribe(bribeForPool[pool]).getReward(tokenID, bribeRewards);
            IBribe(internalBribeForPool[pool]).getReward(tokenID, bribeRewards);
            for (uint i = 0; i < bribeRewards.length; i++) {

                IERC20Upgradeable reward = IERC20Upgradeable(bribeRewards[i]);
                if (reward == VELO) {
                    // when VELO is received as a bribe, add it to the balance
                    // that will be converted to pVELO prior to distribution
                    uint256 newBalance = VELO.balanceOf(address(this));

                    unclaimedSolidBonus += newBalance - veloBalance;
                    veloBalance = newBalance;
                    continue;
                }
                amount = reward.balanceOf(address(this));
                if (amount == 0) continue;

                if (reward.allowance(address(this), distributor) == 0) {
                    reward.safeApprove(distributor, type(uint256).max);
                }

                ITreasury(distributor).depositFee(address(reward), amount);
            }
        }


        amount = unclaimedSolidBonus;
        if (amount > 0) {
            // lock 5% of earned VELO and distribute pVELO to LPF lockers

            uint256 lockAmount = amount / 3;
            pVELO.depositTokens(lockAmount);

            ITreasury(distributor).depositFee(address(pVELO), lockAmount);

            // distribute 10% of earned VELO to pVELO stakers

            amount -= lockAmount;
            VELO.transfer(address(stakingRewards), amount);
            unclaimedSolidBonus = 0;
        }
    }

    // External guarded functions - only callable by other protocol contracts ** //

    function transferDeposit(address pool, address from, address to, uint256 amount) external returns (bool) {

        require(msg.sender == tokenForPool[pool], "Unauthorized caller");
        require(amount > 0, "Cannot transfer zero");

        address gauge = gaugeForPool[pool];
        uint256 total = totalBalances[pool];


        uint256 balance = userBalances[from][pool];
        require(balance >= amount, "Insufficient balance");
        _updateIntegrals(from, pool, gauge, balance, total);
        userBalances[from][pool] = balance - amount;


        balance = userBalances[to][pool];
        _updateIntegrals(to, pool, gauge, balance, total - amount);
        userBalances[to][pool] = balance + amount;
        emit TransferDeposit(pool, from, to, amount);
        return true;
    }

    function onERC721Received(
        address _operator,
        address _from,
        uint256 _tokenID,
        bytes calldata
    )external returns (bytes4) {
        // VeDepositor transfers the NFT to this contract so this callback is required
        require(_operator == address(pVELO));

        if (tokenID == 0) {
            tokenID = _tokenID;
        }

        return bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"));
    }

    // ** Internal functions ** //

    function _deployDepositToken(address pool) internal returns (address token) {
        // taken from https://dddxity-by-example.org/app/minimal-proxy/
        bytes20 targetBytes = bytes20(depositTokenImplementation);
        assembly {
            let clone := mload(0x40)
            mstore(clone, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73000000000000000000000000)
            mstore(add(clone, 0x14), targetBytes)
            mstore(add(clone, 0x28), 0x5af43d82803e903d91602b57fd5bf30000000000000000000000000000000000)
            token := create(0, clone, 0x37)
        }
        IDepositToken(token).initialize(pool);
        return token;
    }

    function _updateIntegrals(
        address user,
        address pool,
        address gauge,
        uint256 balance,
        uint256 total
    ) internal {

        Amounts memory integral = rewardIntegral[pool];
        if (total > 0) {

            uint256 delta = VELO.balanceOf(address(this));
            address[] memory rewards = new address[](1);

            rewards[0] = address(VELO);
            IGauge(gauge).getReward(address(this), rewards);

            delta = VELO.balanceOf(address(this)) - delta;
            if (delta > 0) {

                uint256 fee = delta * 15 / 100;
                delta -= fee;
                unclaimedSolidBonus += fee;

                integral.velo += 1e18 * delta / total;
                integral.lpf += 1e18 * (delta * 10000 / 42069) / total;

                rewardIntegral[pool] = integral;
            }
        }

        if (user != address(0)) {

            Amounts memory integralFor = rewardIntegralFor[user][pool];

            if (integralFor.velo < integral.velo) {

                Amounts storage claims = claimable[user][pool];
                claims.velo += balance * (integral.velo - integralFor.velo) / 1e18;
                claims.lpf += balance * (integral.lpf - integralFor.lpf) / 1e18;

                rewardIntegralFor[user][pool] = integral;
            }
        }
    }
}
