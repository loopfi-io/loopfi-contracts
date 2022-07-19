// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IBooster {
    function forwardRewards(
        uint256 _maxGas,
        uint256 _gasPriceBid,
        bytes calldata _data
    ) external payable returns (uint256 _callIncentive);

    function earmarkRewards(uint256 _pid)
        external
        returns (uint256 _callIncentive);

    function earmarkAndForward(
        uint256 _maxGas,
        uint256 _gasPriceBid,
        bytes calldata _data
    ) external payable returns (uint256 _callIncentive);
}
