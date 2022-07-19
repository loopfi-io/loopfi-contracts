// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract CBridgeMock {
    using SafeERC20 for IERC20;

    /**
     * Simulate the cross chain bridge process
     */
    function send(
        address _receiver,
        address _token,
        uint256 _amount,
        uint64, //_dstChainId,
        uint64, //_nonce,
        uint32 // _maxSlippage
    ) external {
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        // No fee charged
        IERC20(_token).safeTransfer(_receiver, _amount);
    }
}
