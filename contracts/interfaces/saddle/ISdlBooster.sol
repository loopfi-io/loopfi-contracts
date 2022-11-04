// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

interface ISdlBooster {
    function deposit(
        uint256 _pid,
        uint256 _amount,
        bool _stake
    ) external returns (bool);

    function depositAll(uint256 _pid, bool _stake) external returns (bool);

    function withdraw(uint256 _pid, uint256 _amount) external returns (bool);

    function withdrawAll(uint256 _pid) external returns (bool);

    function earmarkRewards(uint256 _pid) external returns (uint256);

    function poolInfo(uint256 _pid)
        external
        returns (
            address lptoken,
            address token,
            address gauge,
            address sdlRewards,
            address stash,
            bool shutdown
        );

    function poolLength() external view returns (uint256);
}
