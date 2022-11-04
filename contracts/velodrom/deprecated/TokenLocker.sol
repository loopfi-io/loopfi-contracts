// SPDX-License-Identifier: MIT
pragma solidity 0.8.11;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

contract TokenLocker is Initializable, OwnableUpgradeable {
    using SafeERC20Upgradeable for IERC20Upgradeable;

    struct StreamData {
        uint256 start;
        uint256 amount;
        uint256 claimed;
    }

    // `weeklyTotalWeight` and `weeklyWeightOf` track the total lock weight for each week,
    // calculated as the sum of [number of tokens] * [weeks to unlock] for all active locks.
    // The array index corresponds to the number of the epoch week.
    uint256[9362] public weeklyTotalWeight;
    mapping(address => uint256[9362]) public weeklyWeightOf;

    // `weeklyUnlocksOf` tracks the actual deposited token balances. Any non-zero value
    // stored at an index < `getWeek` is considered unlocked and may be withdrawn
    mapping(address => uint256[9362]) public weeklyUnlocksOf;

    // `withdrawnUntil` tracks the most recent week for which each user has withdrawn their
    // expired token locks. Values in `weeklyUnlocksOf` with an index less than the related
    // value within `withdrawnUntil` have already been withdrawn.
    mapping(address => uint256) withdrawnUntil;

    // After a lock expires, a user calls to `initiateExitStream` and the withdrawable tokens
    // are streamed out linearly over the following week. This array is used to track data
    // related to the exit stream.
    mapping(address => StreamData) public exitStream;

    IERC20Upgradeable public DOU;
    uint256 public startTime;

    uint256 constant WEEK = 86400 * 7;

    uint256 public MAX_LOCK_WEEKS;

    event NewLock(address indexed user, uint256 amount, uint256 lockWeeks);
    event ExtendLock(
        address indexed user,
        uint256 amount,
        uint256 oldWeeks,
        uint256 newWeeks
    );
    event NewExitStream(
        address indexed user,
        uint256 startTime,
        uint256 amount
    );
    event ExitStreamWithdrawal(
        address indexed user,
        uint256 claimed,
        uint256 remaining
    );

    function initialize(uint256 _maxLockWeeks) public initializer {
        __Ownable_init();

        MAX_LOCK_WEEKS = _maxLockWeeks;
        startTime = (block.timestamp / WEEK) * WEEK;
    }

    function setAddresses(IERC20Upgradeable _dou) external onlyOwner {
        DOU = _dou;
    }

    function getWeek() public view returns (uint256) {
        return (block.timestamp - startTime) / WEEK;
    }

    /**
        @notice Get the current lock weight for a user
     */
    function userWeight(address _user) external view returns (uint256) {
        return weeklyWeightOf[_user][getWeek()];
    }

    /**
        @notice Get the total balance held in this contract for a user,
                including both active and expired locks
     */
    function userBalance(address _user)
        external
        view
        returns (uint256 balance)
    {
        uint256 i = withdrawnUntil[_user] + 1;
        uint256 finish = getWeek() + MAX_LOCK_WEEKS + 1;
        while (i < finish) {
            balance += weeklyUnlocksOf[_user][i];
            i++;
        }
        return balance;
    }

    /**
        @notice Get the current total lock weight
     */
    function totalWeight() external view returns (uint256) {
        return weeklyTotalWeight[getWeek()];
    }

    /**
        @notice Get the user lock weight and total lock weight for the given week
     */
    function weeklyWeight(address _user, uint256 _week)
        external
        view
        returns (uint256, uint256)
    {
        return (weeklyWeightOf[_user][_week], weeklyTotalWeight[_week]);
    }

    /**
        @notice Get data on a user's active token locks
        @param _user Address to query data for
        @return lockData dynamic array of [weeks until expiration, balance of lock]
     */
    function getActiveUserLocks(address _user)
        external
        view
        returns (uint256[2][] memory lockData)
    {
        uint256 length = 0;
        uint256 week = getWeek();
        for (uint256 i = week + 1; i < week + MAX_LOCK_WEEKS + 1; i++) {
            if (weeklyUnlocksOf[_user][i] > 0) length++;
        }
        lockData = new uint256[2][](length);
        uint256 x = 0;
        for (uint256 i = week + 1; i < week + MAX_LOCK_WEEKS + 1; i++) {
            if (weeklyUnlocksOf[_user][i] > 0) {
                lockData[x] = [i - week, weeklyUnlocksOf[_user][i]];
                x++;
            }
        }
        return lockData;
    }

    function lock(address _user, uint256 _amount) external returns (bool) {
        return _lock(_user, _amount, MAX_LOCK_WEEKS);
    }

    /**
        @notice Deposit tokens into the contract to create a new lock.
        @dev A lock is created for a given number of weeks. Minimum 1, maximum `MAX_LOCK_WEEKS`.
             A user can have more than one lock active at a time. A user's total "lock weight"
             is calculated as the sum of [number of tokens] * [weeks until unlock] for all
             active locks. Fees are distributed porportionally according to a user's lock
             weight as a percentage of the total lock weight. At the start of each new week,
             each lock's weeks until unlock is reduced by 1. Locks that reach 0 week no longer
             receive any weight, and tokens may be withdrawn by calling `initiateExitStream`.
        @param _user Address to create a new lock for (does not have to be the caller)
        @param _amount Amount of DOU to lock. This balance transfered from the caller.
        @param _weeks The number of weeks for the lock.
     */
    function _lock(
        address _user,
        uint256 _amount,
        uint256 _weeks
    ) internal returns (bool) {
        require(_weeks > 0, "Min 1 week");
        require(_weeks <= MAX_LOCK_WEEKS, "Exceeds MAX_LOCK_WEEKS");
        require(_amount > 0, "Amount must be nonzero");

        DOU.safeTransferFrom(msg.sender, address(this), _amount);

        uint256 start = getWeek();
        _increaseAmount(weeklyTotalWeight, start, _amount, _weeks, 0);
        _increaseAmount(weeklyWeightOf[_user], start, _amount, _weeks, 0);

        uint256 end = start + _weeks;
        weeklyUnlocksOf[_user][end] = weeklyUnlocksOf[_user][end] + _amount;

        emit NewLock(_user, _amount, _weeks);
        return true;
    }

    /**
        @notice Create an exit stream, to withdraw tokens in expired locks over 1 week
     */
    function initiateExitStream() external returns (bool) {
        StreamData storage stream = exitStream[msg.sender];
        uint256 streamable = streamableBalance(msg.sender);
        require(streamable > 0, "No withdrawable balance");

        uint256 amount = stream.amount - stream.claimed + streamable;
        exitStream[msg.sender] = StreamData({
            start: block.timestamp,
            amount: amount,
            claimed: 0
        });
        withdrawnUntil[msg.sender] = getWeek();

        emit NewExitStream(msg.sender, block.timestamp, amount);
        return true;
    }

    /**
        @notice Withdraw tokens from an active or completed exit stream
     */
    function withdrawExitStream() external returns (bool) {
        StreamData storage stream = exitStream[msg.sender];
        uint256 amount;
        if (stream.start > 0) {
            amount = claimableExitStreamBalance(msg.sender);
            if (stream.start + WEEK < block.timestamp) {
                delete exitStream[msg.sender];
            } else {
                stream.claimed = stream.claimed + amount;
            }
            DOU.safeTransfer(msg.sender, amount);
        }
        emit ExitStreamWithdrawal(
            msg.sender,
            amount,
            stream.amount - stream.claimed
        );
        return true;
    }

    /**
        @notice Get the amount of DOU in expired locks that is
                eligible to be released via an exit stream.
     */
    function streamableBalance(address _user) public view returns (uint256) {
        uint256 finishedWeek = getWeek();

        uint256[9362] storage unlocks = weeklyUnlocksOf[_user];
        uint256 amount;

        for (
            uint256 last = withdrawnUntil[_user] + 1;
            last <= finishedWeek;
            last++
        ) {
            amount = amount + unlocks[last];
        }
        return amount;
    }

    /**
        @notice Get the amount of DOU available to withdraw
                from the active exit stream.
     */
    function claimableExitStreamBalance(address _user)
        public
        view
        returns (uint256)
    {
        StreamData storage stream = exitStream[_user];
        if (stream.start == 0) return 0;
        if (stream.start + WEEK < block.timestamp) {
            return stream.amount - stream.claimed;
        } else {
            uint256 claimable = (stream.amount *
                (block.timestamp - stream.start)) / WEEK;
            return claimable - stream.claimed;
        }
    }

    /**
        @dev Increase the amount within a lock weight array over a given time period
     */
    function _increaseAmount(
        uint256[9362] storage _record,
        uint256 _start,
        uint256 _amount,
        uint256 _rounds,
        uint256 _oldRounds
    ) internal {
        uint256 oldEnd = _start + _oldRounds;
        uint256 end = _start + _rounds;
        for (uint256 i = _start; i < end; i++) {
            uint256 amount = _amount * (end - i);
            if (i < oldEnd) {
                amount -= _amount * (oldEnd - i);
            }
            _record[i] += amount;
        }
    }
}
