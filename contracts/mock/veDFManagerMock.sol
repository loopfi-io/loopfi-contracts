// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./ERC20Mock.sol";

contract veDFManagerMock is ERC20 {
    using SafeERC20 for IERC20;

    IERC20 public df;
    uint256 public startTime;

    mapping(address => uint256) internal rewards;

    constructor(address _df) public ERC20("veDF Mocked Token", "veDFMT") {
        // TODO: should not be zero address
        df = IERC20(_df);
        startTime = block.timestamp;
    }

    function veDF() public view returns (address) {
        return address(this);
    }

    function _stakeUnderlyingAndGetShares(uint256 _amount) internal {
        df.safeTransferFrom(msg.sender, address(this), _amount);
        // Cause DF token is not a deflationary token, so the `_amount` is valid.
        // Assume the exchange rate is always 1.
        _mint(msg.sender, _amount);
    }

    /**
     * @dev Create lock-up information and mint veDF on lock-up amount and duration.
     */
    function create(
        uint256 _amount,
        uint256 /*_dueTime*/
    ) external {
        _stakeUnderlyingAndGetShares(_amount);
        rewards[msg.sender] = block.timestamp;
    }

    /**
     * @dev Create lock-up information and mint veDF on lock-up amount and duration.
     */
    function createInOne(
        uint256 _amount,
        uint256 /*_dueTime*/
    ) external {
        _stakeUnderlyingAndGetShares(_amount);
        rewards[msg.sender] = block.timestamp;
    }

    function refillInOne(uint256 _amount) external {
        _stakeUnderlyingAndGetShares(_amount);
        // In a normal case, it should update rewards at the same time,
        // but at here, we do nothing due to this is test.
    }

    function proExtendInOne(uint256 _amount) external {
        _stakeUnderlyingAndGetShares(_amount);
        // In a normal case, it should update rewards at the same time,
        // but at here, we do nothing due to this is test.
    }

    function proExtend(uint256 _amount) external {
        _stakeUnderlyingAndGetShares(_amount);
        // In a normal case, it should update rewards at the same time,
        // but at here, we do nothing due to this is test.
    }

    function _withdraw() internal {
        uint256 _stakedAmount = balanceOf(msg.sender);
        _burn(msg.sender, _stakedAmount);
        // Assume the exchange rate is always 1.
        df.safeTransfer(msg.sender, _stakedAmount);
    }

    function getReward() public {
        // A simple way to simulate to distribute rewards.
        uint256 _rewardAmount = block.timestamp - rewards[msg.sender];
        // ERC20Mock(address(df)).mint(msg.sender, _rewardAmount * 0.001e18);
        ERC20Mock(address(df)).mint(msg.sender, 1000 * 1e18);
        rewards[msg.sender] = block.timestamp;
    }

    function getRewardInOne() public {
        // A simple way to simulate to distribute rewards.
        uint256 _rewardAmount = block.timestamp - rewards[msg.sender];
        ERC20Mock(address(df)).mint(msg.sender, 1000 * 1e18);
        rewards[msg.sender] = block.timestamp;
    }

    function earnedInOne(address account) public pure returns (uint256) {
        return 1000 * 1e18;
    }

    function exit() external {
        getReward();
        _withdraw();
    }

    function exitInOne() external {
        getReward();
        _withdraw();
    }

    function estimateLockerAPY(address) external pure returns (uint256) {
        return 234 * 1e16; // 234%
    }
}
