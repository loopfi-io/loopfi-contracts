// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "./Interfaces.sol";
import "./library/Ownable.sol";
import "./library/Multicall.sol";
import "./interfaces/IveDFManager.sol";
import "./interfaces/IOutbox.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract DFDepositor is Ownable, Multicall {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public df;
    address public veDF;
    uint256 private constant MAXTIME = 4 * 364 * 86400;
    uint256 private constant WEEK = 7 * 86400;

    uint256 public lockIncentive = 10; //incentive to users who spend gas to lock df
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public immutable staker;
    uint256 public lastlockedTime;

    address public immutable outbox;

    /**
     * @param _df, DF Token.
     * @param _veDF, veDF token contract.
     * @param _staker, voter contract.
     */
    constructor(
        address _df,
        address _veDF,
        address _staker,
        address _outbox
    ) public {
        __Ownable_init();

        df = _df;
        veDF = _veDF;
        staker = _staker;
        outbox = _outbox;
    }

    function setFees(uint256 _lockIncentive) external onlyOwner {
        if (_lockIncentive >= 0 && _lockIncentive <= 30) {
            lockIncentive = _lockIncentive;
        }
    }

    function dueTime() internal view returns (uint256 _dueTime) {
        uint256 _startTime = IveDFManager(veDF).startTime();
        uint256 _maxDuration = 4 * 52 weeks;

        uint256 _duration = _maxDuration.sub(
            block.timestamp.sub(_startTime).mod(WEEK)
        );
        _dueTime = _duration.add(block.timestamp);
    }

    function initialLock() external onlyOwner {
        uint256 balance = IERC20(veDF).balanceOf(staker);
        if (balance == 0) {
            uint256 lockedTime = dueTime();

            //create new lock
            uint256 dfBalanceStaker = IERC20(df).balanceOf(staker);

            // For veDF, stake amount can not be zero
            if (dfBalanceStaker > 0) {
                IStaker(staker).createLock(dfBalanceStaker, lockedTime);
                lastlockedTime = block.timestamp;
            }
        }
    }

    //lock df
    function _lockDF() internal {
        uint256 dfBalance = IERC20(df).balanceOf(address(this));
        if (dfBalance > 0) {
            IERC20(df).safeTransfer(staker, dfBalance);
        }

        //increase ammount
        uint256 dfBalanceStaker = IERC20(df).balanceOf(staker);
        if (dfBalanceStaker == 0) {
            return;
        }

        // increase by time if over 2 week buffer
        uint256 _currentTime = block.timestamp;
        if (_currentTime.sub(lastlockedTime) > 2 weeks) {
            IStaker(staker).increaseByTime(dfBalanceStaker);
            lastlockedTime = _currentTime;
        } else {
            // increase by amount
            IStaker(staker).increaseByAmount(dfBalanceStaker);
        }
    }

    function lockDF() external returns (uint256 _callIncentive) {
        uint256 _dfBalance = IERC20(df).balanceOf(address(this));

        // Transfer incentive first
        _callIncentive = _dfBalance.mul(lockIncentive).div(FEE_DENOMINATOR);
        if (_callIncentive > 0) {
            IERC20(df).safeTransfer(msg.sender, _callIncentive);
        }

        _lockDF();
    }

    function unlockDF() external onlyOwner {
        IStaker(staker).release();
    }

    /**
     * @dev Execute to claim funds from L2 to L1.
     */
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
    ) external {
        IOutbox(outbox).executeTransaction(
            batchNum,
            proof,
            index,
            l2Sender,
            destAddr,
            l2Block,
            l1Block,
            l2Timestamp,
            amount,
            calldataForL1
        );
    }
}
