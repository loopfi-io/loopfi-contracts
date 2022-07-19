// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "./library/Ownable.sol";
import "./interfaces/IArbBridgeL2.sol";

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract DFDepositorL2 is Ownable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public l1DF;
    address public l2DF;

    uint256 public lockIncentive = 10; //incentive to users who spend gas to lock df
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public immutable minter;
    uint256 public incentiveDF = 0;

    address public immutable arbGatewayRouter;
    address public immutable l1CounterParty;

    uint256 public lockThreshold;

    /**
     * @param _l1DF, L1 DF contract
     * @param _l2DF, L2 DF contract
     * @param _minter, pDFL2 contract
     * @param _stakingPool, baseRewardPool L2 contract
     * @param _arbGatewayRouter, arbitrum gateway router contract
     * @param _l1CounterParty, L1 depositor contract
     * @param _lockThreshold, threshold for cross chain transfer
     */
    constructor(
        address _l1DF,
        address _l2DF,
        address _minter,
        address _stakingPool,
        address _arbGatewayRouter,
        address _l1CounterParty,
        uint256 _lockThreshold
    ) public {
        __Ownable_init();

        l1DF = _l1DF;
        l2DF = _l2DF;
        minter = _minter;

        arbGatewayRouter = _arbGatewayRouter;
        l1CounterParty = _l1CounterParty;
        lockThreshold = _lockThreshold;

        // Make necessary approval.
        IERC20[] memory _tokens = new IERC20[](1);
        address[] memory _recipients = new address[](1);
        uint256[] memory _amounts = new uint256[](1);

        _tokens[0] = IERC20(_minter);
        _recipients[0] = _stakingPool;
        _amounts[0] = uint256(-1);

        approveX(_tokens, _recipients, _amounts);
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

    function setFees(uint256 _lockIncentive) external onlyOwner {
        if (_lockIncentive >= 0 && _lockIncentive <= 30) {
            lockIncentive = _lockIncentive;
        }
    }

    function setLockThreshold(uint256 _lockThreshold) external onlyOwner {
        lockThreshold = _lockThreshold;
    }

    /**
     * Instead of locking df, depositing it to the bridge
     */
    function _lockDF() internal {
        uint256 dfBalance = IERC20(l2DF).balanceOf(address(this));

        require(
            dfBalance >= lockThreshold,
            "amount does not reach the threshold!"
        );

        if (dfBalance > 0) {
            IArbBridgeL2(arbGatewayRouter).outboundTransfer(
                l1DF, // l1Token
                l1CounterParty, // to
                dfBalance, // amount
                ""
            );
        }
    }

    function lockDF() external returns (uint256 _callIncentive) {
        _lockDF();

        // Current incentive.
        _callIncentive = incentiveDF;
        //mint incentives
        if (_callIncentive > 0) {
            ITokenMinter(minter).mint(msg.sender, _callIncentive);
            incentiveDF = 0;
        }
    }

    //deposit df for pDF
    //can locking immediately or defer locking to someone else by paying a fee.
    //while users can choose to lock or defer, this is mostly in place so that
    //the df reward contract isnt costly to claim rewards
    function deposit(
        uint256 _amount,
        bool _lock,
        address _stakeAddress
    ) public {
        require(_amount > 0, "!>0");

        //move tokens here
        IERC20(l2DF).safeTransferFrom(msg.sender, address(this), _amount);

        if (_lock) {
            _lockDF();
            if (incentiveDF > 0) {
                //add the incentive tokens here so they can be staked together
                _amount = _amount.add(incentiveDF);
                incentiveDF = 0;
            }
        } else {
            //defer lock cost to another user
            uint256 callIncentive = _amount.mul(lockIncentive).div(
                FEE_DENOMINATOR
            );
            _amount = _amount.sub(callIncentive);

            //add to a pool for lock caller
            incentiveDF = incentiveDF.add(callIncentive);
        }

        bool depositOnly = _stakeAddress == address(0);
        if (depositOnly) {
            //mint for msg.sender
            ITokenMinter(minter).mint(msg.sender, _amount);
        } else {
            //mint here
            ITokenMinter(minter).mint(address(this), _amount);
            //stake for msg.sender
            IRewards(_stakeAddress).stakeFor(msg.sender, _amount);
        }
    }

    function deposit(uint256 _amount, bool _lock) external {
        deposit(_amount, _lock, address(0));
    }

    function depositAll(bool _lock, address _stakeAddress) external {
        uint256 dfBal = IERC20(l2DF).balanceOf(msg.sender);
        deposit(dfBal, _lock, _stakeAddress);
    }
}
