// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IveDFManager {
    function veDF() external view returns (address);

    function earnedInOne(address _account) external returns (uint256);

    function createInOne(uint256 _amount, uint256 _dueTime) external;

    function proExtendInOne(uint256 _amount) external;

    function refillInOne(uint256 _amount) external;

    function exitInOne() external;

    function balanceOf(address account) external view returns (uint256);

    function getLocker(address _lockerAddress)
        external
        view
        returns (
            uint32,
            uint32,
            uint96
        );

    function getRewardInOne() external;

    function startTime() external view returns (uint256);
}
