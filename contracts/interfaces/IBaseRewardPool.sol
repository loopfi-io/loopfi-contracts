// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IBaseRewardPool {
    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function earned(address account) external view returns (uint256);

    function rewardRate() external view returns (uint256);

    function stake(uint256 _amount) external returns (bool);

    function stakeAll() external returns (bool);

    function stakeFor(address _for, uint256 _amount) external;

    function withdraw(
        uint256 amount,
        bool claim,
        bool earmark
    ) external;

    function withdrawAll(bool claim, bool earmark) external;

    function getReward(bool earmark) external returns (bool);

    function rewardToken() external view returns (address);

    function earmarkRewards() external returns (uint256 _callIncentive);
}
