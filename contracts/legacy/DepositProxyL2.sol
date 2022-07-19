// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

import "../interfaces/ICBridge.sol";
import "../interfaces/IDFDepositor.sol";
import "../interfaces/IBaseRewardPool.sol";
import "../library/Ownable.sol";

contract DepositProxyL2 is Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    address public immutable df;
    address public immutable depositor;
    address public immutable stakePool;

    uint64 public immutable dstChainId;
    address public immutable bridge;
    address public immutable l2CounterParty;
    uint256 public constant FEE_DENOMINATOR = 10000;

    /**
     * @param _df, DF contract
     * @param _depositor, DFDepositor contract
     * @param _stakePool, baseRewardPool contract
     * @param _dstChainId, destination chain id
     * @param _bridge, cBridge contract
     * @param _l2CounterParty, boosterL2 contract
     */
    constructor(
        address _df,
        address _depositor,
        address _stakePool,
        uint64 _dstChainId,
        address _bridge,
        address _l2CounterParty
    ) public {
        __Ownable_init();

        df = _df;
        depositor = _depositor;
        stakePool = _stakePool;

        dstChainId = _dstChainId;
        bridge = _bridge;
        l2CounterParty = _l2CounterParty;

        // Make necessary approval.
        IERC20[] memory _tokens = new IERC20[](2);
        address[] memory _recipients = new address[](2);
        uint256[] memory _amounts = new uint256[](2);

        _tokens[0] = IERC20(_df);
        _recipients[0] = _depositor;
        _amounts[0] = uint256(-1);

        _tokens[1] = IERC20(_df);
        _recipients[1] = _bridge;
        _amounts[1] = uint256(-1);

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

    function deposit() external {
        IDFDepositor(depositor).depositAll(false, stakePool);
    }

    function getReward() external returns (uint256 _callIncentive) {
        IBaseRewardPool(stakePool).getReward(false);

        // Should distribute incentive for trigger.
        uint256 _lockIncentive = IDFDepositor(depositor).lockIncentive();
        uint256 _dfBalance = IERC20(df).balanceOf(address(this));

        _callIncentive = _dfBalance.mul(_lockIncentive).div(FEE_DENOMINATOR);

        IERC20(df).safeTransfer(msg.sender, _callIncentive);

        _dfBalance = _dfBalance.sub(_callIncentive);

        ICBridge(bridge).send(
            l2CounterParty,
            df,
            _dfBalance,
            dstChainId,
            uint64(block.timestamp), // nonce
            3000 // maxSlippage
        );

        return _callIncentive;
    }
}
