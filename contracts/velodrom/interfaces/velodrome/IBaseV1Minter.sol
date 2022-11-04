// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface IBaseV1Minter {
    function active_period() external view returns (uint256);
    function update_period() external returns (uint);
}
