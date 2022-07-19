// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract ArbiBridgeMock {
    using SafeERC20 for IERC20;

    address public token;

    constructor(address _token) public {
        token = _token;
    }

    /**
     * Simulate the cross chain bridge from L2 to L1
     */
    function outboundTransfer(
        address l1Token,
        address, // to,
        uint256 amount,
        bytes calldata
    ) external {
        IERC20(l1Token).safeTransferFrom(msg.sender, address(this), amount);
    }

    /**
     * Simulate the cross chain bridge from L1 to L2
     */
    function outboundTransfer(
        address l1Token,
        address to,
        uint256 amount,
        uint256,
        uint256,
        bytes calldata
    ) external payable {
        IERC20(l1Token).safeTransferFrom(msg.sender, address(this), amount);

        // No fee charged
        IERC20(l1Token).safeTransfer(to, amount);
    }

    /**
     * Simulate the claim from L1
     */
    function executeTransaction(
        uint256, // batchNum,
        bytes32[] calldata, // proof,
        uint256, //index,
        address, //l2Sender,
        address destAddr,
        uint256, // l2Block,
        uint256, // l1Block,
        uint256, // l2Timestamp,
        uint256 amount,
        bytes calldata // calldataForL1
    ) external {
        // No fee charged
        IERC20(token).safeTransfer(destAddr, amount);
    }
}
