// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IDepositProxyL2 {
    function deposit() external;

    function getReward() external returns (uint256);
}
