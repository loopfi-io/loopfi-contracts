// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface IGauge {
    function deposit(uint amount, uint tokenId) external;
    function withdraw(uint amount) external;
    function getReward(address account, address[] memory tokens) external;
    function earned(address token, address account) external view returns (uint256);
    function rewardsListLength() external view returns (uint256);
    function rewards(uint256 index) external view returns (address);
    function notifyRewardAmount(address token, uint amount) external;
    function rewardRate(address pool) external view returns (uint256);
    function claimFees() external returns (uint claimed0, uint claimed1);
}
