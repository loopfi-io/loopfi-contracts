// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "./interfaces/IERC20.sol";
import "./interfaces/velodrome/IVotingEscrow.sol";
import "./interfaces/velodrome/IVeDist.sol";
import "./interfaces/loopfi/ILpDepositor.sol";
import "./interfaces/loopfi/ITreasury.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";


contract VeDepositor is IERC20, Initializable, OwnableUpgradeable {

    string public constant name = "Loopfi Velodrome";
    string public constant symbol = "pVELO";
    uint8 public constant decimals = 18;
    uint256 public override totalSupply;

    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;

    // VELO contracts
    IERC20 public token;

    IVotingEscrow public votingEscrow;
    IVeDist public veDistributor;

    // LPF contracts
    ILpDepositor public lpDepositor;
    ITreasury public treasury;

    uint256 public tokenID;
    uint256 public unlockTime;

    uint256 constant MAX_LOCK_TIME = 86400 * 365 * 4;
    uint256 constant WEEK = 86400 * 7;



    event ClaimedFromVeDistributor(address indexed user, uint256 amount);
    event Merged(address indexed user, uint256 tokenID, uint256 amount);
    event UnlockTimeUpdated(uint256 unlockTime);


    function initialize(
        IERC20 _token,
        IVotingEscrow _votingEscrow,
        IVeDist _veDist
    ) public initializer {
        __Ownable_init();

        token = _token;
        votingEscrow = _votingEscrow;
        veDistributor = _veDist;

        // approve vesting escrow to transfer VELO (for adding to lock)
        _token.approve(address(_votingEscrow), type(uint256).max);
        emit Transfer(address(0), msg.sender, 0);
    }

    function setAddresses(
        ILpDepositor _lpDepositor,
        ITreasury _treasury
    ) external onlyOwner {
        lpDepositor = _lpDepositor;
        treasury = _treasury;

        // approve treasury to transfer this token (for distributing LPF)
        allowance[address(this)][address(_treasury)] = type(uint256).max;
    }


    function approve(address _spender, uint256 _value)
        external
        override
        returns (bool)
    {
        allowance[msg.sender][_spender] = _value;
        emit Approval(msg.sender, _spender, _value);
        return true;
    }

    /** shared logic for transfer and transferFrom */
    function _transfer(
        address _from,
        address _to,
        uint256 _value
    ) internal {
        require(balanceOf[_from] >= _value, "Insufficient balance");
        balanceOf[_from] -= _value;
        balanceOf[_to] += _value;
        emit Transfer(_from, _to, _value);
    }

    /**
        @notice Transfer tokens to a specified address
        @param _to The address to transfer to
        @param _value The amount to be transferred
        @return Success boolean
     */
    function transfer(address _to, uint256 _value)
        public
        override
        returns (bool)
    {
        _transfer(msg.sender, _to, _value);
        return true;
    }

    /**
        @notice Transfer tokens from one address to another
        @param _from The address which you want to send tokens from
        @param _to The address which you want to transfer to
        @param _value The amount of tokens to be transferred
        @return Success boolean
     */
    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public override returns (bool) {
        require(allowance[_from][msg.sender] >= _value, "Insufficient allowance");
        if (allowance[_from][msg.sender] != type(uint256).max) {
            allowance[_from][msg.sender] -= _value;
        }
        _transfer(_from, _to, _value);
        return true;
    }


    /**
        @notice Deposit VELO tokens and mint pVELO
        @param _amount Amount of VELO to deposit
        @return bool success
     */
    function depositTokens(uint256 _amount) external returns (bool) {
        require(tokenID != 0, "First deposit must be NFT");

        token.transferFrom(msg.sender, address(this), _amount);
        votingEscrow.increase_amount(tokenID, _amount);

        _mint(msg.sender, _amount);
        extendLockTime();

        return true;
    }

    /**
        @notice Extend the lock time of the protocol's veVELO NFT
        @dev Lock times are also extended each time new pVELO is minted.
             If the lock time is already at the maximum duration, calling
             this function does nothing.
     */
    function extendLockTime() public {
        uint256 maxUnlock = ((block.timestamp + MAX_LOCK_TIME) / WEEK) * WEEK;
        if (maxUnlock > unlockTime) {
            votingEscrow.increase_unlock_time(tokenID, MAX_LOCK_TIME);
            unlockTime = maxUnlock;
            emit UnlockTimeUpdated(unlockTime);
        }
    }

    /**
        @notice Claim veVELO received via ve(3,3)
        @dev This function is unguarded, anyone can call to claim at any time.
             The new veVELO is represented by newly minted pVELO, which is
             then sent to `Treasury` and streamed to LPF lockers starting
             at the beginning of the following epoch week.
     */
    function claimFromVeDistributor() external returns (bool) {
        veDistributor.claim(tokenID);

        // calculate the amount by comparing the change in the locked balance
        // to the known total supply, this is necessary because anyone can call
        // `veDistributor.claim` for any NFT
        (uint256 amount,) = votingEscrow.locked(tokenID);

        amount -= totalSupply;

        if (amount > 0) {
            _mint(address(this), amount);
            treasury.depositFee(address(this), balanceOf[address(this)]);
            emit ClaimedFromVeDistributor(address(this), amount);
        }

        return true;
    }

    function _mint(address _user, uint256 _amount) internal {
        balanceOf[_user] += _amount;
        totalSupply += _amount;
        emit Transfer(address(0), _user, _amount);
    }
}
