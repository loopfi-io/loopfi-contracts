// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface ILpDepositor {
    function setTokenID(uint256 tokenID) external returns (bool);
    function userBalances(address user, address pool) external view returns (uint256);
    function totalBalances(address pool) external view returns (uint256);
    function transferDeposit(address pool, address from, address to, uint256 amount) external returns (bool);
    function whitelist(address token) external returns (bool);
    function gaugeForPool(address pool) external view returns (address);
    function bribeForPool(address pool) external view returns (address);
}
