// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract SdlDepositor {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public constant sdl =
        address(0xf1Dc500FdE233A4055e25e5BbF516372BC4F6871);
    address public constant escrow =
        address(0xD2751CdBED54B87777E805be36670D7aeAe73bb2);
    uint256 private constant MAXTIME = 4 * 364 * 86400;
    uint256 private constant WEEK = 7 * 86400;

    uint256 public lockIncentive = 10; //incentive to users who spend gas to lock sdl
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public feeManager;
    address public immutable staker;
    address public immutable minter;
    uint256 public incentiveSdl = 0;
    uint256 public unlockTime;

    constructor(address _staker, address _minter) public {
        staker = _staker;
        minter = _minter;
        feeManager = msg.sender;
    }

    function setFeeManager(address _feeManager) external {
        require(msg.sender == feeManager, "!auth");
        feeManager = _feeManager;
    }

    function setFees(uint256 _lockIncentive) external {
        require(msg.sender == feeManager, "!auth");

        if (_lockIncentive >= 0 && _lockIncentive <= 30) {
            lockIncentive = _lockIncentive;
        }
    }

    function initialLock() external {
        require(msg.sender == feeManager, "!auth");

        uint256 vesdl = IERC20(escrow).balanceOf(staker);
        if (vesdl == 0) {
            uint256 unlockAt = block.timestamp + MAXTIME;
            uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

            //release old lock if exists
            IStaker(staker).release();
            //create new lock
            uint256 sdlBalanceStaker = IERC20(sdl).balanceOf(staker);
            IStaker(staker).createLock(sdlBalanceStaker, unlockAt);
            unlockTime = unlockInWeeks;
        }
    }

    //lock curve
    function _lockSaddle() internal {
        uint256 sdlBalance = IERC20(sdl).balanceOf(address(this));
        if (sdlBalance > 0) {
            IERC20(sdl).safeTransfer(staker, sdlBalance);
        }

        //increase ammount
        uint256 sdlBalanceStaker = IERC20(sdl).balanceOf(staker);
        if (sdlBalanceStaker == 0) {
            return;
        }

        //increase amount
        IStaker(staker).increaseAmount(sdlBalanceStaker);

        uint256 unlockAt = block.timestamp + MAXTIME;
        uint256 unlockInWeeks = (unlockAt / WEEK) * WEEK;

        //increase time too if over 2 week buffer
        if (unlockInWeeks.sub(unlockTime) > 2) {
            IStaker(staker).increaseTime(unlockAt);
            unlockTime = unlockInWeeks;
        }
    }

    function lockSaddle() external {
        _lockSaddle();

        //mint incentives
        if (incentiveSdl > 0) {
            ITokenMinter(minter).mint(msg.sender, incentiveSdl);
            incentiveSdl = 0;
        }
    }

    //deposit sdl for cvxSdl
    //can locking immediately or defer locking to someone else by paying a fee.
    //while users can choose to lock or defer, this is mostly in place so that
    //the cvx reward contract isnt costly to claim rewards
    function deposit(
        uint256 _amount,
        bool _lock,
        address _stakeAddress
    ) public {
        require(_amount > 0, "!>0");

        if (_lock) {
            //lock immediately, transfer directly to staker to skip an erc20 transfer
            IERC20(sdl).safeTransferFrom(msg.sender, staker, _amount);
            _lockSaddle();
            if (incentiveSdl > 0) {
                //add the incentive tokens here so they can be staked together
                _amount = _amount.add(incentiveSdl);
                incentiveSdl = 0;
            }
        } else {
            //move tokens here
            IERC20(sdl).safeTransferFrom(msg.sender, address(this), _amount);
            //defer lock cost to another user
            uint256 callIncentive = _amount.mul(lockIncentive).div(
                FEE_DENOMINATOR
            );
            _amount = _amount.sub(callIncentive);

            //add to a pool for lock caller
            incentiveSdl = incentiveSdl.add(callIncentive);
        }

        bool depositOnly = _stakeAddress == address(0);
        if (depositOnly) {
            //mint for msg.sender
            ITokenMinter(minter).mint(msg.sender, _amount);
        } else {
            //mint here
            ITokenMinter(minter).mint(address(this), _amount);
            //stake for msg.sender
            IERC20(minter).safeApprove(_stakeAddress, 0);
            IERC20(minter).safeApprove(_stakeAddress, _amount);
            IRewards(_stakeAddress).stakeFor(msg.sender, _amount);
        }
    }

    function deposit(uint256 _amount, bool _lock) external {
        deposit(_amount, _lock, address(0));
    }

    function depositAll(bool _lock, address _stakeAddress) external {
        uint256 sdlBal = IERC20(sdl).balanceOf(msg.sender);
        deposit(sdlBal, _lock, _stakeAddress);
    }
}
