// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface ITreasury {
    function depositFee(address _token, uint256 _amount) external returns (bool);
}
