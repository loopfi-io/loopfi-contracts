// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IRewardDistributorL2 {
    function earmarkRewards(uint256 /*_pid*/) external returns (uint256);
}
