// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IArbBridgeL1 {
    function outboundTransfer(
        address l1Token,
        address to,
        uint256 amount,
        uint256 maxGas,
        uint256 gasPriceBid,
        bytes calldata data
    ) external payable;
}
