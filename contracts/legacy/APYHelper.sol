// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "../Interfaces.sol";

contract APYHelper {
    using SafeMath for uint256;

    function getBaseAPY(address _rewarder, address _recipient)
        public
        returns (uint256 _apy)
    {
        _apy = IRewarder(_rewarder).estimateLockerAPY(_recipient);
    }

    function getAPY(
        uint256 _baseAPY,
        uint256 _proportion,
        uint256 _base,
        uint256 _total,
        uint256 _staked
    ) public pure returns (uint256) {
        if (_staked == 0 || _base == 0) return 0;

        return _baseAPY.mul(_proportion).mul(_total).div(_staked).div(_base);
    }

    function getAPY5(
        address _rewarder,
        address _recipient,
        address _earmarker,
        address _stakeToken,
        address _stakingPool
    ) external returns (uint256) {
        return
            getAPY(
                getBaseAPY(_rewarder, _recipient),
                IEarmarker(_earmarker).lockIncentive().add(
                    IEarmarker(_earmarker).platformFee()
                ),
                IEarmarker(_earmarker).FEE_DENOMINATOR(),
                IERC20(_stakeToken).totalSupply(),
                IERC20(_stakingPool).totalSupply()
            );
    }

    function getAPY4(
        uint256 _baseAPY,
        address _earmarker,
        address _stakeToken,
        address _stakingPool
    ) external view returns (uint256) {
        return
            getAPY(
                _baseAPY,
                IEarmarker(_earmarker).lockIncentive(),
                IEarmarker(_earmarker).FEE_DENOMINATOR(),
                IERC20(_stakeToken).totalSupply(),
                IERC20(_stakingPool).totalSupply()
            );
    }
}
