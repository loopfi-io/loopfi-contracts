// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./Interfaces.sol";
import "./interfaces/IveDFManager.sol";

import "./library/Ownable.sol";
import "./library/Initializable.sol";
import "./DFVoter.sol";

contract DFVoterManager is Initializable, Ownable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public df;
    address public veDF;

    address public veDFManager;

    address public booster;
    address public depositor;

    uint256 private constant MAX_DURATION = 4 * 52 weeks;

    uint256 public voterMaxBalance;
    DFVoter[] public voters;

    /**
     * @param _df, DF Token.
     * @param _veDFManager, veDFManager contract.
     */
    constructor(
        address _df,
        address _veDFManager,
        uint256 _voterMaxBalance
    ) public {
        initialize(_df, _veDFManager, _voterMaxBalance);
    }

    function initialize(
        address _df,
        address _veDFManager,
        uint256 _voterMaxBalance
    ) public initializer {
        __Ownable_init();

        df = _df;
        veDF = IveDFManager(_veDFManager).veDF();
        veDFManager = _veDFManager;
        voterMaxBalance = _voterMaxBalance;
    }

    function getName() external pure returns (string memory) {
        return "DFVoterManger";
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

    function setVoterMaxBalance(uint256 _voterMaxBalance) external onlyOwner {
        require(_voterMaxBalance > 0, "_voterMaxBalance must > 0");

        voterMaxBalance = _voterMaxBalance;
    }

    function dueTime() internal view returns (uint256 _dueTime) {
        uint256 _startTime = IveDFManager(veDFManager).startTime();

        uint256 _duration = MAX_DURATION.sub(
            block.timestamp.sub(_startTime).mod(1 weeks)
        );

        _dueTime = _duration.add(block.timestamp);
    }

    function createVoterIfNeeded(uint256 _value) internal returns (bool) {
        uint256 len = voters.length;

        if (
            len == 0 ||
            (len > 0 &&
                IERC20(veDF).balanceOf(address(voters[len - 1])) >=
                voterMaxBalance)
        ) {
            DFVoter _newVoter = new DFVoter(df, veDFManager);
            voters.push(_newVoter);

            IERC20(df).safeTransfer(address(_newVoter), _value);
            _newVoter.createLock(_value, dueTime());

            return true;
        }

        return false;
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

        if (!createVoterIfNeeded(_value)) {
            DFVoter _lastVoter = voters[voters.length - 1];

            IERC20(df).safeTransfer(address(_lastVoter), _value);
            _lastVoter.increaseByAmount(_value);
        }

        return true;
    }

    function increaseByTime(uint256 _value) external returns (bool) {
        require(msg.sender == depositor, "!auth");

        bool created = createVoterIfNeeded(_value);

        uint256 _index;
        // Extended for all voters except the last one
        for (; _index + 1 < voters.length; _index++) {
            voters[_index].increaseByTime(0);
        }

        // Handle the last one
        if (!created) {
            DFVoter _lastVoter = voters[_index];

            IERC20(df).safeTransfer(address(_lastVoter), _value);
            _lastVoter.increaseByTime(_value);
        }

        return true;
    }

    function release() external returns (bool) {
        require(msg.sender == depositor, "!auth");

        for (uint256 _index = 0; _index < voters.length; _index++) {
            voters[_index].release();
        }

        return true;
    }

    function delegate(uint256 _index, address _delegatee)
        external
        returns (bool)
    {
        require(msg.sender == booster, "!auth");
        require(_index < voters.length, "index >= length");

        voters[_index].delegate(_delegatee);
        return true;
    }

    function claimDF(
        address /*_gauge*/
    ) external returns (uint256) {
        require(msg.sender == booster, "!auth");

        uint256 _balance = 0;
        for (uint256 _index = 0; _index < voters.length; _index++) {
            _balance = _balance.add(voters[_index].claimDF(booster));
        }

        return _balance;
    }

    function execute(
        address _to,
        uint256 _value,
        bytes calldata _data
    ) external payable onlyOwner returns (bool, bytes memory) {
        (bool success, bytes memory result) = _to.call{value: _value}(_data);

        return (success, result);
    }

    function votersLength() external view returns (uint256) {
        return voters.length;
    }

    function getVoters() external view returns (DFVoter[] memory) {
        return voters;
    }

    function upgrade(uint256 _voterMaxBalance) external {
        require(_voterMaxBalance > 0, "_voterMaxBalance must > 0");
        require(voterMaxBalance == 0, "Already upgraded");

        voterMaxBalance = _voterMaxBalance;
    }
}
