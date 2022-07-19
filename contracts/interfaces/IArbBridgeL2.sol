// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface IArbBridgeL2 {
    function outboundTransfer(
        address l1Token,
        address to,
        uint256 amount,
        bytes calldata data
    ) external;
}
