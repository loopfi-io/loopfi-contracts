// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

interface IBaseV1Voter {
    function external_bribes(address gauge) external view returns (address bribe);
    function internal_bribes(address gauge) external view returns (address bribe);
    function gauges(address pool) external view returns (address gauge);
    function poolForGauge(address gauge) external view returns (address pool);
    function createGauge(address pool) external returns (address);
    function vote(uint tokenId, address[] calldata pools, int256[] calldata weights) external;
    function vote(uint tokenId, address[] calldata pools, uint256[] calldata weights) external;
    function whitelist(address token, uint tokenId) external;
    function listing_fee() external view returns (uint256);
    function _ve() external view returns (address);
    function isWhitelisted(address pool) external view returns (bool);
    function usedWeights(uint256 tokenId) external view returns (uint256);
}
