// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./library/Ownable.sol";

contract BoosterL2 is Ownable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public df;

    uint256 public lockIncentive = 9990; //incentive to df stakers
    uint256 public stakerIncentive = 0; //incentive to native token stakers
    uint256 public earmarkIncentive = 10; //incentive to users who spend gas to make calls
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public stakerRewards; //lpf rewards
    address public lockRewards; //pDF rewards(df)

    bool public isShutdown;

    /**
     * @param _df. DF Token.
     */
    constructor(address _df) public {
        __Ownable_init();

        df = _df;
        isShutdown = false;
    }

    function setRewardContracts(address _rewards, address _stakerRewards)
        external
        onlyOwner
    {

        //reward contracts are immutable or else the owner
        //has a means to redeploy and mint velo token via rewardClaimed()
        if (lockRewards == address(0) || stakerRewards == address(0)) {
            lockRewards = _rewards;
            stakerRewards = _stakerRewards;
        }
    }

    function setFees(
        uint256 _lockFees,
        uint256 _stakerFees,
        uint256 _callerFees
    ) external onlyOwner {
        uint256 total = _lockFees.add(_stakerFees).add(_callerFees);
        require(total == FEE_DENOMINATOR, "!FEE_DENOMINATOR");

        //values must be within certain ranges
        if ( _stakerFees <= 1500 && _callerFees <= 100) {
            lockIncentive = _lockFees;
            stakerIncentive = _stakerFees;
            earmarkIncentive = _callerFees;
        }
    }

    //shutdown this contract.
    //  unstake and pull all lp tokens to this address
    //  only allow withdrawals
    function shutdownSystem() external onlyOwner {
        isShutdown = true;
    }

    //claim df and extra rewards and disperse to reward contracts
    function _earmarkRewards(
        uint256, /*_pid*/
        bool incentivized
    ) internal returns (uint256 _incentive) {
        //df balance
        uint256 dfBal = IERC20(df).balanceOf(address(this));

        if (dfBal > 0) {
            if (incentivized) {
                _incentive = dfBal.mul(earmarkIncentive).div(FEE_DENOMINATOR);

                //send all incentives for calling
                IERC20(df).safeTransfer(msg.sender, _incentive);
            }

            uint256 _stakerIncentive = dfBal.mul(stakerIncentive).div(
                FEE_DENOMINATOR
            );

            if (_stakerIncentive > 0) {
                //send stakers's share of df to reward contract
                IERC20(df).safeTransfer(stakerRewards, _stakerIncentive);
                IRewards(stakerRewards).queueNewRewards(_stakerIncentive);
            }

            uint256 _lockIncentive = dfBal.sub(_incentive).sub(
                _stakerIncentive
            );

            //send lockers' share of df to reward contract
            IERC20(df).safeTransfer(lockRewards, _lockIncentive);
            IRewards(lockRewards).queueNewRewards(_lockIncentive);
        }

        return _incentive;
    }

    function earmarkRewards(uint256 _pid)
        external
        returns (uint256 _callIncentive)
    {
        require(!isShutdown, "shutdown");
        _callIncentive = _earmarkRewards(_pid, true);
    }

    //callback from reward contract when df is received.
    function rewardClaimed(
        uint256, /*_pid*/
        address _address,
        uint256 _amount
    ) external returns (bool) {}
}
