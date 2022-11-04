// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface ISdlDepositor {
    function depositAll(bool _lock, address _stakeAddress) external;

    function deposit(
        uint256 _amount,
        bool _lock,
        address _stakeAddress
    ) external;

    function deposit(uint256 _amount, bool _lock) external;

    function lockSaddle() external;

    function incentiveSdl() external view returns (uint256);

    function FEE_DENOMINATOR() external view returns (uint256);

    function lockIncentive() external view returns (uint256);
}
