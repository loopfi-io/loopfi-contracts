// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "../IERC20.sol";

interface ILoopfiToken is IERC20 {
    function mint(address _to, uint256 _value) external returns (bool);
}
