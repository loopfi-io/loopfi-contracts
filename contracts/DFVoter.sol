// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "./Interfaces.sol";
import "./interfaces/IveDFManager.sol";

import "./library/Ownable.sol";

contract DFVoter is Ownable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;

    address public df;
    address public veDF;
    address public veDFManager;

    /**
     * @param _df, DF Token.
     * @param _veDFManager, veDFManager contract.
     */
    constructor(address _df, address _veDFManager) public {
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

    function createLock(uint256 _value, uint256 _unlockTime)
        external
        onlyOwner
        returns (bool)
    {
        IveDFManager(veDFManager).createInOne(_value, _unlockTime);
        return true;
    }

    function increaseByAmount(uint256 _value)
        external
        onlyOwner
        returns (bool)
    {
        IveDFManager(veDFManager).refillInOne(_value);
        return true;
    }

    function increaseByTime(uint256 _value) external onlyOwner returns (bool) {
        IveDFManager(veDFManager).proExtendInOne(_value);
        return true;
    }

    function release() external onlyOwner returns (bool) {
        IveDFManager(veDFManager).exitInOne();
        return true;
    }

    function delegate(address _delegatee) external onlyOwner returns (bool) {
        IGovernanceToken(veDF).delegate(_delegatee);
        return true;
    }

    function claimDF(address _to) external onlyOwner returns (uint256) {
        uint256 _balance = 0;
        try IveDFManager(veDFManager).getRewardInOne() {
            _balance = IERC20(df).balanceOf(address(this));
            IERC20(df).safeTransfer(_to, _balance);
        } catch {}

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
}
