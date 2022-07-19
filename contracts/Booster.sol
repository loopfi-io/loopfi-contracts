// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./Interfaces.sol";
import "./interfaces/IArbBridgeL1.sol";
import "./library/Ownable.sol";

contract Booster is Ownable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public df;

    uint256 public lockIncentive = 8500; //incentive to df stakers
    uint256 public platformFee = 1500; //possible fee to build treasury
    uint256 public forwardIncentive = 100; //incentive to users who spend gas to make calls
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public immutable staker;

    address public treasury;
    address public lockRewards; //pDF rewards(df)

    bool public isShutdown;

    address public immutable arbCustomGateway;
    address public immutable arbGatewayRouter;
    address public l2CounterParty;

    /**
     * @param _df. DF Token.
     * @param _staker. Vote contract.
     * @param _arbCustomGateway, L1 Arbitrum custom gateway contract
     * @param _arbGatewayRouter, L1 Arbitrum gateway router contract
     */
    constructor(
        address _df,
        address _staker,
        address _arbCustomGateway,
        address _arbGatewayRouter,
        address _l2CounterParty
    ) public {
        __Ownable_init();

        df = _df;
        isShutdown = false;
        staker = _staker;
        treasury = address(0);

        arbCustomGateway = _arbCustomGateway;
        arbGatewayRouter = _arbGatewayRouter;
        l2CounterParty = _l2CounterParty;

        // Make necessary approval.
        IERC20[] memory _tokens = new IERC20[](1);
        address[] memory _recipients = new address[](1);
        uint256[] memory _amounts = new uint256[](1);

        _tokens[0] = IERC20(_df);
        _recipients[0] = _arbCustomGateway;
        _amounts[0] = uint256(-1);

        approveX(_tokens, _recipients, _amounts);
    }

    /// SETTER SECTION ///
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
        uint256 total = _lockFees.add(_platform);
        require(total == FEE_DENOMINATOR, "!FEE_DENOMINATOR");

        //values must be within certain ranges
        if (_callerFees <= 100 && _platform <= 1500) {
            lockIncentive = _lockFees;
            forwardIncentive = _callerFees;
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
    ) internal {
        //claim df
        uint256 dfBal = IStaker(staker).claimDF(address(0));

        if (dfBal > 0) {
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
        }
    }

    function earmarkRewards(uint256 _pid)
        public
        returns (uint256)
    {
        require(!isShutdown, "shutdown");
        _earmarkRewards(_pid);
    }

    function approveX(
        IERC20[] memory _tokens,
        address[] memory _recipients,
        uint256[] memory _amounts
    ) public onlyOwner {
        require(
            _tokens.length == _recipients.length &&
                _tokens.length == _amounts.length,
            "approveX: The length of input parameters does not match!"
        );
        for (uint256 i = 0; i < _tokens.length; i++) {
            _tokens[i].safeApprove(_recipients[i], _amounts[i]);
        }
    }

    function forwardRewards(
        uint256 _maxGas,
        uint256 _gasPriceBid,
        bytes calldata _data
    ) public payable returns (uint256 _callIncentive) {
        // Should distribute incentive for trigger.
        uint256 _dfBalance = IERC20(df).balanceOf(address(this));

        _callIncentive = _dfBalance.mul(forwardIncentive).div(FEE_DENOMINATOR);
        IERC20(df).safeTransfer(msg.sender, _callIncentive);

        _dfBalance = _dfBalance.sub(_callIncentive);

        IArbBridgeL1(arbGatewayRouter).outboundTransfer{value: msg.value}(
            df, // l1Token
            l2CounterParty, // to
            _dfBalance, // amount
            _maxGas,
            _gasPriceBid,
            _data
        );

        return _callIncentive;
    }

    function earmarkAndForward(
        uint256 _maxGas,
        uint256 _gasPriceBid,
        bytes calldata _data
    ) external payable returns (uint256 _callIncentive) {
        _callIncentive = earmarkRewards(0);
        _callIncentive = _callIncentive.add(
            forwardRewards(_maxGas, _gasPriceBid, _data)
        );
    }
}
