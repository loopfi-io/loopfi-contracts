// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

interface ISnapshotDelegate {
    function delegation(address delegator, bytes32 namespace)
        external
        view
        returns (address);

    function setDelegate(bytes32 id, address delegate) external;

    function clearDelegate(bytes32 id) external;
}
