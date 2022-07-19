// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "../Interfaces.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "../library/Ownable.sol";

contract BoosterLegacy is Ownable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public df;

    uint256 public lockIncentive = 8400; //incentive to df stakers
    uint256 public earmarkIncentive = 100; //incentive to users who spend gas to make calls
    uint256 public platformFee = 1500; //possible fee to build treasury
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public immutable staker;

    address public treasury;
    address public lockRewards; //pDF rewards(df)

    bool public isShutdown;
    address public L2Depositor;

    /**
     * @param _df. DF Token.
     * @param _staker. Vote contract.
     */
    constructor(address _df, address _staker) public {
        __Ownable_init();

        df = _df;
        isShutdown = false;
        staker = _staker;
        treasury = address(0);
    }

    /// SETTER SECTION ///

    function setL2Depositor(address _L2Depositor) external onlyOwner {
        require(
            _L2Depositor != L2Depositor,
            "setL2Depositor: Do not set the same L2 depositor!"
        );
        L2Depositor = _L2Depositor;
    }

    function setRewardContracts(address _rewards) external onlyOwner {

        //reward contracts are immutable or else the owner
        //has a means to redeploy and mint velo token via rewardClaimed()
        if (lockRewards == address(0)) {
            lockRewards = _rewards;
        }
    }

    function setFees(
        uint256 _lockFees,
        uint256 _callerFees,
        uint256 _platform
    ) external onlyOwner {

        uint256 total = _lockFees.add(_callerFees).add(_platform);
        require(total == FEE_DENOMINATOR, "!FEE_DENOMINATOR");

        //values must be within certain ranges
        if (_callerFees <= 100 && _platform <= 1500) {
            lockIncentive = _lockFees;
            earmarkIncentive = _callerFees;
            platformFee = _platform;
        }
    }

    // TODO:
    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    //shutdown this contract.
    //  unstake and pull all lp tokens to this address
    //  only allow withdrawals
    function shutdownSystem() external onlyOwner {
        isShutdown = true;
    }

    //delegate address votes on dao
    function delegate(uint256 _pid, address _delegatee) external onlyOwner {

        IStaker(staker).delegate(_pid, _delegatee);
    }

    //claim df and extra rewards and disperse to reward contracts
    function _earmarkRewards(
        uint256 /*_pid*/
    ) internal returns (uint256 _incentive) {
        //claim df
        IStaker(staker).claimDF(address(0));

        //df balance
        uint256 dfBal = IERC20(df).balanceOf(address(this));

        if (dfBal > 0) {
            _incentive = dfBal.mul(earmarkIncentive).div(FEE_DENOMINATOR);

            //send treasury
            if (
                treasury != address(0) &&
                treasury != address(this) &&
                platformFee > 0
            ) {
                //only subtract after address condition check
                uint256 _platform = dfBal.mul(platformFee).div(FEE_DENOMINATOR);
                dfBal = dfBal.sub(_platform);
                IERC20(df).safeTransfer(treasury, _platform);
            }

            uint256 _lockIncentive = dfBal.sub(_incentive);
            //send lockers' share of df to reward contract
            IERC20(df).safeTransfer(lockRewards, _lockIncentive);
            IRewards(lockRewards).queueNewRewards(_lockIncentive);
        }

        _incentive = _incentive.add(IDepositProxyL2(L2Depositor).getReward());
        //send all incentives for calling
        IERC20(df).safeTransfer(msg.sender, _incentive);

        return _incentive;
    }

    function earmarkRewards(uint256 _pid)
        external
        returns (uint256 _callIncentive)
    {
        require(!isShutdown, "shutdown");
        _callIncentive = _earmarkRewards(_pid);
    }

    //callback from reward contract when df is received.
    function rewardClaimed(
        uint256, /*_pid*/
        address, /*_address*/
        uint256 /*_amount*/
    ) external returns (bool) {}
}
