// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IDFDepositor {
    function depositAll(bool _lock, address _stakeAddress) external;

    function deposit(
        uint256 _amount,
        bool _lock,
        address _stakeAddress
    ) external;

    function deposit(uint256 _amount, bool _lock) external;

    function lockDF() external returns (uint256);

    function incentiveDF() external view returns (uint256);

    function FEE_DENOMINATOR() external view returns (uint256);

    function lockIncentive() external view returns (uint256);

    function claimFunds(
        uint256 batchNum,
        bytes32[] calldata proof,
        uint256 index,
        address l2Sender,
        address destAddr,
        uint256 l2Block,
        uint256 l1Block,
        uint256 l2Timestamp,
        uint256 amount,
        bytes calldata calldataForL1
    ) external;

    function multicall(bytes[] calldata data)
        external
        returns (bytes[] memory results);
}
