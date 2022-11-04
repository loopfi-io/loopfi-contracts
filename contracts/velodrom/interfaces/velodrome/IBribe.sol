// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface IBribe {
    function getReward(uint tokenId, address[] memory tokens) external;
    function rewardsListLength() external view returns (uint256);
    function rewards(uint256 index) external view returns (address);
    function earned(address token, uint256 tokenId) external view returns (uint256);
    function notifyRewardAmount(address token, uint amount) external;
    function periodFinish(address token) external view returns (uint256);
}
