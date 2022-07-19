// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface ILPFMasterChef {
    function userInfo(uint256 _pid, address _user)
        external
        view
        returns (uint256 _amount, uint256 _rewardDebt);

    function poolInfo(uint256 _pid)
        external
        view
        returns (
            address _lp,
            uint256 _allocPoint,
            uint256 _lastRewardBlock,
            uint256 _accVelPerShare,
            address _rewarder
        );

    function pendingVel(uint256 _pid, address _user)
        external
        view
        returns (uint256);

    function deposit(uint256 _pid, uint256 _amount) external;

    function withdraw(uint256 _pid, uint256 _amount) external;

    function claim(uint256 _pid, address _account) external;

    function emergencyWithdraw(uint256 _pid) external;
}
