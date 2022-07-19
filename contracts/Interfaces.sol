// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./interfaces/IDepositProxyL2.sol";

interface IGovernanceToken {
    function delegate(address delegatee) external;

    function getCurrentVotes(address account) external view returns (uint96);
}

interface IMinter {
    function mint(address) external;

    function getRewardInOne() external;
}

interface IStaker {
    function deposit(address, address) external;

    function withdraw(address) external;

    function withdraw(
        address,
        address,
        uint256
    ) external;

    function withdrawAll(address, address) external;

    function createLock(uint256, uint256) external;

    function increaseByAmount(uint256) external;

    function increaseByTime(uint256) external;

    function release() external;

    function claimDF(address) external returns (uint256);

    function claimRewards(address) external;

    function claimFees(address, address) external;

    function delegate(uint256 pid, address delegatee) external;

    function balanceOfPool(address) external view returns (uint256);

    function operator() external view returns (address);

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external returns (bool, bytes memory);
}

interface IRewards {
    function stake(address, uint256) external;

    function stakeFor(address, uint256) external;

    function withdraw(address, uint256) external;

    function exit(address) external;

    function getReward(address) external;

    function queueNewRewards(uint256) external;

    function notifyRewardAmount(uint256) external;

    function addExtraReward(address) external;

    function stakingToken() external view returns (address);

    function rewardToken() external view returns (address);

    function earned(address account) external view returns (uint256);
}

interface IFeeDistro {
    function claim() external;

    function token() external view returns (address);
}

interface ITokenMinter {
    function mint(address, uint256) external;

    function burn(address, uint256) external;
}

interface IDeposit {
    function isShutdown() external view returns (bool);

    function balanceOf(address _account) external view returns (uint256);

    function totalSupply() external view returns (uint256);

    function poolInfo(uint256)
        external
        view
        returns (
            address,
            address,
            address,
            address,
            address,
            bool
        );

    function rewardClaimed(
        uint256,
        address,
        uint256
    ) external;

    function withdrawTo(
        uint256,
        uint256,
        address
    ) external;

    function claimRewards(uint256, address) external returns (bool);

    function rewardArbitrator() external returns (address);

    function setGaugeRedirect(uint256 _pid) external returns (bool);

    function owner() external returns (address);

    function earmarkRewards(uint256 _pid) external returns (uint256);
}

interface IDFDeposit {
    function deposit(uint256, bool) external;

    function lockIncentive() external view returns (uint256);
}

interface IRewarder {
    function estimateLockerAPY(address _account) external returns (uint256);
}

interface IEarmarker {
    function lockIncentive() external view returns (uint256);

    function platformFee() external view returns (uint256);

    function FEE_DENOMINATOR() external view returns (uint256);
}
