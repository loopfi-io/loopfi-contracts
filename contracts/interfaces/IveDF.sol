// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface IveDF {
    function getCurrentVotes(address account) external view returns (uint96);
    function delegates(address account) external view returns (address);
    function delegate(address delegatee) external;
    function balanceOf(address account) external view returns (uint256);
}
