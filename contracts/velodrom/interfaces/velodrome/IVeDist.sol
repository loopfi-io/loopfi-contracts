// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface IVeDist {
    function claim(uint _tokenId) external returns (uint);
    function claimable(uint _tokenId) external view returns (uint);
}
