// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface ILockedCvx{
    struct LockedBalance {
        uint112 amount;
        uint112 boosted;
        uint32 unlockTime;
    }

    struct Reward {
        bool useBoost;
        uint40 periodFinish;
        uint208 rewardRate;
        uint40 lastUpdateTime;
        uint208 rewardPerTokenStored;
    }

    struct EarnedData {
        address token;
        uint256 amount;
    }

    function lock(address _account, uint256 _amount, uint256 _spendRatio) external;
    function processExpiredLocks(bool _relock, uint256 _spendRatio, address _withdrawTo) external;
    function getReward(address _account, bool _stake) external;
    function balanceAtEpochOf(uint256 _epoch, address _user) view external returns(uint256 amount);
    function totalSupplyAtEpoch(uint256 _epoch) view external returns(uint256 supply);
    function epochCount() external view returns(uint256);
    function epochs(uint256 _id) external view returns(uint224,uint32);
    function checkpointEpoch() external;
    function balanceOf(address _account) external view returns(uint256);
    function lockedBalanceOf(address _user) external view returns(uint256 amount);
    function pendingLockOf(address _user) external view returns(uint256 amount);
    function pendingLockAtEpochOf(uint256 _epoch, address _user) view external returns(uint256 amount);
    function totalSupply() view external returns(uint256 supply);
    function lockedBalances(
        address _user
    ) view external returns(
        uint256 total,
        uint256 unlockable,
        uint256 locked,
        LockedBalance[] memory lockData
    );
    function addReward(
        address _rewardsToken,
        address _distributor,
        bool _useBoost
    ) external;
    function approveRewardDistributor(
        address _rewardsToken,
        address _distributor,
        bool _approved
    ) external;
    function setStakeLimits(uint256 _minimum, uint256 _maximum) external;
    function setBoost(uint256 _max, uint256 _rate, address _receivingAddress) external;
    function setKickIncentive(uint256 _rate, uint256 _delay) external;
    function shutdown() external;
    function recoverERC20(address _tokenAddress, uint256 _tokenAmount) external;

    function rewardTokens(uint256 _index) external view returns (address);
    function rewardData(address) external view returns (Reward memory);
    function rewardsDuration() external view returns (uint256);
    function lockDuration() external view returns (uint256);
    function rewardWeightOf(address _user) view external returns(uint256 amount);
    function claimableRewards(address _account) external view returns(EarnedData[] memory);
    function userLocks(address _account) external view returns(LockedBalance[] memory);
    function findEpochId(uint256 _time) view external returns(uint256 epoch);

    function lockedSupply() view external returns(uint256);
}
