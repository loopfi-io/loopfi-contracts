// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./library/Ownable.sol";

//receive treasury funds. operator can withdraw
//allow execute so that certain funds could be staked etc
//allow treasury ownership to be transfered during the vesting stage
contract TreasuryFunds is Ownable {
    using SafeERC20 for IERC20;
    using Address for address;

    event WithdrawTo(address indexed user, uint256 amount);

    constructor() public {
        __Ownable_init();
    }

    function withdrawTo(
        IERC20 _asset,
        uint256 _amount,
        address _to
    ) external onlyOwner {
        _asset.safeTransfer(_to, _amount);
        emit WithdrawTo(_to, _amount);
    }

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external payable onlyOwner returns (bool, bytes memory) {
        (bool success, bytes memory result) = _to.call{value: _value}(_data);

        return (success, result);
    }
}
