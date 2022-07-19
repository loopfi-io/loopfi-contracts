// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "./interfaces/IveDFManager.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./library/Initializable.sol";
import "./library/Ownable.sol";

contract DFVoterProxy is Initializable, Ownable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public df;
    address public veDF;

    address public veDFManager;

    address public booster;
    address public depositor;

    /**
     * @param _df, DF Token.
     * @param _veDFManager, veDFManager contract.
     */
    constructor(address _df, address _veDFManager) public {
        initialize(_df, _veDFManager);
    }

    function initialize(address _df, address _veDFManager) public initializer {
        __Ownable_init();

        df = _df;
        veDFManager = _veDFManager;

        // Make necessary approval.
        IERC20[] memory _tokens = new IERC20[](2);
        address[] memory _recipients = new address[](2);
        uint256[] memory _amounts = new uint256[](2);

        _tokens[0] = IERC20(_df);
        _recipients[0] = _veDFManager;
        _amounts[0] = uint256(-1);

        veDF = IveDFManager(_veDFManager).veDF();
        _tokens[1] = IERC20(veDF);
        _recipients[1] = _veDFManager;
        _amounts[1] = uint256(-1);

        approveX(_tokens, _recipients, _amounts);
    }

    function getName() external pure returns (string memory) {
        return "DFVoterProxy";
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

    function setBooster(address _booster) external onlyOwner {
        require(
            booster == address(0) || IDeposit(booster).isShutdown() == true,
            "needs shutdown"
        );

        booster = _booster;
    }

    function setDepositor(address _depositor) external onlyOwner {
        depositor = _depositor;
    }

    function createLock(uint256 _value, uint256 _unlockTime)
        external
        returns (bool)
    {
        require(msg.sender == depositor, "!auth");

        IveDFManager(veDFManager).createInOne(_value, _unlockTime);
        return true;
    }

    function increaseByAmount(uint256 _value) external returns (bool) {
        require(msg.sender == depositor, "!auth");

        IveDFManager(veDFManager).refillInOne(_value);
        return true;
    }

    function increaseByTime(uint256 _value) external returns (bool) {
        require(msg.sender == depositor, "!auth");

        IveDFManager(veDFManager).proExtendInOne(_value);
        return true;
    }

    function release() external returns (bool) {
        require(msg.sender == depositor, "!auth");
        IveDFManager(veDFManager).exitInOne();
        return true;
    }

    function delegate(
        uint256, /*_pid*/
        address _delegatee
    ) external returns (bool) {
        require(msg.sender == booster, "!auth");
        IGovernanceToken(veDF).delegate(_delegatee);
        return true;
    }

    function claimDF(
        address /*_gauge*/
    ) external returns (uint256) {
        require(msg.sender == booster, "!auth");

        uint256 _balance = 0;
        try IveDFManager(veDFManager).getRewardInOne() {
            _balance = IERC20(df).balanceOf(address(this));
            IERC20(df).safeTransfer(booster, _balance);
        } catch {}

        return _balance;
    }

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external payable returns (bool, bytes memory) {
        require(msg.sender == booster, "!auth");

        (bool success, bytes memory result) = _to.call{value: _value}(_data);

        return (success, result);
    }
}
