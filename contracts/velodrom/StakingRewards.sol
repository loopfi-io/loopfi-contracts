// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";


contract StakingRewards is Initializable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    /* ========== STATE VARIABLES ========== */

    struct Reward {
        uint256 periodFinish;
        uint256 rewardRate;
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
        uint256 balance;
        uint256 duration;
    }

    IERC20Upgradeable public stakingToken;

    address[2] public rewardTokens;

    mapping(address => Reward) public rewardData;

    // user -> reward token -> amount

    mapping(address => mapping(address => uint256)) public userRewardPerTokenPaid;
    //
    mapping(address => mapping(address => uint256)) public rewards;


    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    event RewardAdded(address indexed rewardsToken, uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, address indexed rewardsToken, uint256 reward);

    function initialize() public initializer {
        __Ownable_init();
    }


    function setAddresses(
        address _stakingToken,
        address[2] memory _rewardTokens,
        uint256[2] memory _durations
    ) external onlyOwner {
        stakingToken = IERC20Upgradeable(_stakingToken);  // pVELO
        rewardTokens = _rewardTokens;  // VELO, LPF
        for (uint i; i < _durations.length; i++) {
            address token = rewardTokens[i];
            Reward storage r = rewardData[token];
            r.duration = _durations[i];
        }
    }


    function lastTimeRewardApplicable(address _rewardsToken) public view returns (uint256) {
        uint256 periodFinish = rewardData[_rewardsToken].periodFinish;
        return block.timestamp < periodFinish ? block.timestamp : periodFinish;
    }


    function rewardPerToken(address _rewardsToken) public view returns (uint256) {
        if (totalSupply == 0) {
            return rewardData[_rewardsToken].rewardPerTokenStored;
        }
        uint256 duration = lastTimeRewardApplicable(_rewardsToken) - rewardData[_rewardsToken].lastUpdateTime;
        uint256 pending = duration * rewardData[_rewardsToken].rewardRate * 1e18 / totalSupply;
        return
            rewardData[_rewardsToken].rewardPerTokenStored + pending;
    }


    function earned(address account, address _rewardsToken) public view returns (uint256) {
        uint256 rpt = rewardPerToken(_rewardsToken) - userRewardPerTokenPaid[account][_rewardsToken];
        return balanceOf[account] * rpt / 1e18 + rewards[account][_rewardsToken];
    }


    function getRewardForDuration(address _rewardsToken) external view returns (uint256) {
        return rewardData[_rewardsToken].rewardRate * rewardData[_rewardsToken].duration;
    }


    function stake(uint256 amount) external updateReward(msg.sender) {
        require(amount > 0, "Cannot stake 0");
        totalSupply += amount;
        balanceOf[msg.sender] += amount;
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);
        emit Staked(msg.sender, amount);
    }


    function withdraw(uint256 amount) public updateReward(msg.sender) {
        require(amount > 0, "Cannot withdraw 0");
        totalSupply -= amount;
        balanceOf[msg.sender] -= amount;
        stakingToken.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }


    function getReward() public updateReward(msg.sender) {

        for (uint i; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            Reward storage r = rewardData[token];
            if (block.timestamp + r.duration > r.periodFinish + 3600) {
                // if last reward update was more than 1 hour ago, check for new rewards
                uint256 unseen = IERC20Upgradeable(token).balanceOf(address(this)) - r.balance;
                if (unseen > 0) {
                    _notifyRewardAmount(r, unseen);
                    emit RewardAdded(token, unseen);
                }
            }
            uint256 reward = rewards[msg.sender][token];
            if (reward > 0) {
                rewards[msg.sender][token] = 0;
                r.balance -= reward;
                IERC20Upgradeable(token).safeTransfer(msg.sender, reward);
                emit RewardPaid(msg.sender, token, reward);
            }
        }
    }

    function exit() external {
        withdraw(balanceOf[msg.sender]);
        getReward();
    }

    function _notifyRewardAmount(Reward storage r, uint256 reward) internal {

        if (block.timestamp >= r.periodFinish) {
            r.rewardRate = reward / r.duration;
        } else {
            uint256 remaining = r.periodFinish - block.timestamp;
            uint256 leftover = remaining * r.rewardRate;
            r.rewardRate = (reward + leftover) / r.duration;
        }
        r.lastUpdateTime = block.timestamp;
        r.periodFinish = block.timestamp + r.duration;
        r.balance += reward;
    }

    modifier updateReward(address account) {
        for (uint i; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            rewardData[token].rewardPerTokenStored = rewardPerToken(token);
            rewardData[token].lastUpdateTime = lastTimeRewardApplicable(token);
            if (account != address(0)) {
                rewards[account][token] = earned(account, token);
                userRewardPerTokenPaid[account][token] = rewardData[token].rewardPerTokenStored;
            }
        }
        _;
    }

}
