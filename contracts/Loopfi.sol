// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./Interfaces.sol";
import "./interfaces/MathUtil.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/utils/EnumerableSet.sol";

import "./library/Ownable.sol";

contract Loopfi is ERC20, Ownable {
    using SafeERC20 for IERC20;
    using Address for address;
    using SafeMath for uint256;
    using EnumerableSet for EnumerableSet.AddressSet;

    uint256 public maxSupply = 1000 * 1000 * 1000 * 1e18; //1000mil

    EnumerableSet.AddressSet internal minters;

    struct MinterData {
        uint256 cap;
        uint256 mint;
    }

    mapping(address => MinterData) public minterData;

    constructor() public ERC20("Loopfi", "LPF") {
        __Ownable_init();
    }

    function _checkMaxSupply() internal view {
        uint256 _totalCap;
        for (uint256 i = 0; i < minters.length(); i++) {
            _totalCap = _totalCap + minterData[minters.at(i)].cap;
        }

        require(_totalCap <= maxSupply, ">maxSupply");
    }

    function addMinters(address[] calldata _minters, uint256[] calldata _caps)
        external
        onlyOwner
    {
        require(_minters.length == _caps.length, "!equalLength");

        for (uint256 i = 0; i < _minters.length; i++) {
            require(!minters.contains(_minters[i]), "alreadyAdded");

            minters.add(_minters[i]);
            minterData[_minters[i]] = MinterData(_caps[i], 0);
        }

        _checkMaxSupply();
    }

    function setMinterCaps(
        address[] calldata _minters,
        uint256[] calldata _caps
    ) external onlyOwner {
        require(_minters.length == _caps.length, "!equalLength");

        for (uint256 i = 0; i < _minters.length; i++) {
            require(minters.contains(_minters[i]), "!minter");

            require(
                _caps[i] >= minterData[_minters[i]].mint,
                "alreadyExceededCap"
            );

            minterData[_minters[i]].cap = _caps[i];
        }

        _checkMaxSupply();
    }

    function removeMinter(address _minter) external onlyOwner {
        require(minters.contains(_minter), "!minter");

        // To stop minter have already minted, set its cap to current mint
        require(minterData[_minter].mint == 0, "can not remove minted minter");

        minters.remove(_minter);
        delete minterData[_minter];

        // no need to check MaxSupply here
    }

    function mint(address _to, uint256 _amount) external {
        if (!minters.contains(msg.sender)) {
            //dont error just return. if a shutdown happens, rewards on old system
            //can still be claimed, just wont mint vel
            return;
        }

        MinterData storage _data = minterData[msg.sender];

        //supply cap check
        _amount = MathUtil.min(_amount, _data.cap.sub(_data.mint));
        if (_amount == 0) {
            return;
        }

        //mint
        _mint(_to, _amount);
        _data.mint = _data.mint.add(_amount);
    }

    function getMinters() external view returns (address[] memory _addresses) {
        uint256 _len = minters.length();
        _addresses = new address[](_len);
        for (uint256 i = 0; i < _len; i++) {
            _addresses[i] = minters.at(i);
        }
    }
}
