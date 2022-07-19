// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

/*
   ____            __   __        __   _
  / __/__ __ ___  / /_ / /  ___  / /_ (_)__ __
 _\ \ / // // _ \/ __// _ \/ -_)/ __// / \ \ /
/___/ \_, //_//_/\__//_//_/\__/ \__//_/ /_\_\
     /___/
* Synthetix: lpfRewardPool.sol
*
* Docs: https://docs.synthetix.io/
*
*
* MIT License
* ===========
*
* Copyright (c) 2020 Synthetix
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
*/

import "../Interfaces.sol";
import "../library/MathUtil.sol";
import "../library/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

contract LPFRewardPool is Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public immutable rewardToken;
    IERC20 public immutable stakingToken;
    uint256 public constant duration = 7 days;
    uint256 public constant FEE_DENOMINATOR = 10000;

    address public immutable operator;
    address public immutable dfDeposits;
    address public immutable pDFRewards;
    IERC20 public immutable pDFToken;
    address public immutable rewardManager;

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;
    uint256 public queuedRewards = 0;
    uint256 public currentRewards = 0;
    uint256 public historicalRewards = 0;
    uint256 public constant newRewardRatio = 830;
    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;
    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

    address[] public extraRewards;

    event RewardAdded(uint256 reward);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);

    /**
     * @param stakingToken_ velo token
     * @param rewardToken_ df token
     * @param dfDeposits_ depositorL2
     * @param pDFRewards_ baseRewardPool
     * @param pDFToken_ pDFToken
     * @param operator_ boosterL2
     * @param rewardManager_ reward manager
     */
    constructor(
        address stakingToken_,
        address rewardToken_,
        address dfDeposits_,
        address pDFRewards_,
        address pDFToken_,
        address operator_,
        address rewardManager_
    ) public {
        __Ownable_init();

        stakingToken = IERC20(stakingToken_);
        rewardToken = IERC20(rewardToken_);
        operator = operator_;
        rewardManager = rewardManager_;
        dfDeposits = dfDeposits_;
        pDFRewards = pDFRewards_;
        pDFToken = IERC20(pDFToken_);

        // Make necessary approval.
        IERC20[] memory _tokens = new IERC20[](2);
        address[] memory _recipients = new address[](2);
        uint256[] memory _amounts = new uint256[](2);

        _tokens[0] = IERC20(rewardToken_);
        _recipients[0] = dfDeposits_;
        _amounts[0] = uint256(-1);

        _tokens[1] = IERC20(pDFToken_);
        _recipients[1] = pDFRewards_;
        _amounts[1] = uint256(-1);

        approveX(_tokens, _recipients, _amounts);
    }

    function approveX(
        IERC20[] memory _tokens,
        address[] memory  _recipients,
        uint256[] memory _amounts
    ) public onlyOwner {
        require(
            _tokens.length == _recipients.length && _tokens.length == _amounts.length,
            "approveX: The length of input parameters does not match!"
        );
        for (uint256 i = 0; i < _tokens.length; i++) {
            _tokens[i].safeApprove(_recipients[i], _amounts[i]);
        }
    }

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function extraRewardsLength() external view returns (uint256) {
        return extraRewards.length;
    }

    function addExtraReward(address _reward) external {
        require(msg.sender == rewardManager, "!authorized");
        require(_reward != address(0), "!reward setting");

        extraRewards.push(_reward);
    }

    function clearExtraRewards() external {
        require(msg.sender == rewardManager, "!authorized");
        delete extraRewards;
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earnedReward(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    function lastTimeRewardApplicable() public view returns (uint256) {
        return MathUtil.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored.add(
                lastTimeRewardApplicable()
                    .sub(lastUpdateTime)
                    .mul(rewardRate)
                    .mul(1e18)
                    .div(supply)
            );
    }

    function earnedReward(address account) internal view returns (uint256) {
        return
            balanceOf(account)
                .mul(rewardPerToken().sub(userRewardPerTokenPaid[account]))
                .div(1e18)
                .add(rewards[account]);
    }

    function earned(address account) external view returns (uint256) {
        uint256 depositFeeRate = IDFDeposit(dfDeposits).lockIncentive();

        uint256 r = earnedReward(account);
        uint256 fees = r.mul(depositFeeRate).div(FEE_DENOMINATOR);

        //fees dont apply until whitelist+veDF lock begins so will report
        //slightly less value than what is actually received.
        return r.sub(fees);
    }

    function stake(uint256 _amount) public updateReward(msg.sender) {
        require(_amount > 0, "RewardPool : Cannot stake 0");

        //also stake to linked rewards
        uint256 length = extraRewards.length;
        for (uint256 i = 0; i < length; i++) {
            IRewards(extraRewards[i]).stake(msg.sender, _amount);
        }

        //add supply
        _totalSupply = _totalSupply.add(_amount);
        //add to sender balance sheet
        _balances[msg.sender] = _balances[msg.sender].add(_amount);
        //take tokens from sender
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        emit Staked(msg.sender, _amount);
    }

    function stakeAll() external {
        uint256 balance = stakingToken.balanceOf(msg.sender);
        stake(balance);
    }

    function stakeFor(address _for, uint256 _amount) public updateReward(_for) {
        require(_amount > 0, "RewardPool : Cannot stake 0");

        //also stake to linked rewards
        uint256 length = extraRewards.length;
        for (uint256 i = 0; i < length; i++) {
            IRewards(extraRewards[i]).stake(_for, _amount);
        }

        //add supply
        _totalSupply = _totalSupply.add(_amount);
        //add to _for's balance sheet
        _balances[_for] = _balances[_for].add(_amount);
        //take tokens from sender
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);

        emit Staked(msg.sender, _amount);
    }

    function withdraw(uint256 _amount, bool claim)
        public
        updateReward(msg.sender)
    {
        require(_amount > 0, "RewardPool : Cannot withdraw 0");

        //also withdraw from linked rewards
        uint256 length = extraRewards.length;
        for (uint256 i = 0; i < length; i++) {
            IRewards(extraRewards[i]).withdraw(msg.sender, _amount);
        }

        _totalSupply = _totalSupply.sub(_amount);
        _balances[msg.sender] = _balances[msg.sender].sub(_amount);
        stakingToken.safeTransfer(msg.sender, _amount);
        emit Withdrawn(msg.sender, _amount);

        if (claim) {
            getReward(msg.sender, true, false);
        }
    }

    function withdrawAll(bool claim) external {
        withdraw(_balances[msg.sender], claim);
    }

    function getReward(
        address _account,
        bool _claimExtras,
        bool _stake
    ) public updateReward(_account) {
        uint256 reward = earnedReward(_account);

        if (reward > 0) {
            rewards[_account] = 0;

            IDFDeposit(dfDeposits).deposit(reward, false);

            uint256 pDFBalance = pDFToken.balanceOf(address(this));
            if (_stake) {

                IRewards(pDFRewards).stakeFor(_account, pDFBalance);
            } else {
                pDFToken.safeTransfer(_account, pDFBalance);
            }
            emit RewardPaid(_account, pDFBalance);
        }

        //also get rewards from linked rewards
        if (_claimExtras) {
            uint256 length = extraRewards.length;
            for (uint256 i = 0; i < length; i++) {
                IRewards(extraRewards[i]).getReward(_account);
            }
        }
    }

    function getReward(bool _stake) external {
        getReward(msg.sender, true, _stake);
    }

    function donate(uint256 _amount) external returns (bool) {
        IERC20(rewardToken).safeTransferFrom(
            msg.sender,
            address(this),
            _amount
        );
        queuedRewards = queuedRewards.add(_amount);
    }

    function queueNewRewards(uint256 _rewards) external {
        require(msg.sender == operator, "!authorized");

        _rewards = _rewards.add(queuedRewards);

        if (block.timestamp >= periodFinish) {
            notifyRewardAmount(_rewards);
            queuedRewards = 0;
            return;
        }

        //et = now - (finish-duration)
        uint256 elapsedTime = block.timestamp.sub(periodFinish.sub(duration));
        //current at now: rewardRate * elapsedTime
        uint256 currentAtNow = rewardRate * elapsedTime;
        uint256 queuedRatio = currentAtNow.mul(1000).div(_rewards);
        if (queuedRatio < newRewardRatio) {
            notifyRewardAmount(_rewards);
            queuedRewards = 0;
        } else {
            queuedRewards = _rewards;
        }
    }

    function notifyRewardAmount(uint256 reward)
        internal
        updateReward(address(0))
    {
        historicalRewards = historicalRewards.add(reward);
        if (block.timestamp >= periodFinish) {
            rewardRate = reward.div(duration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            reward = reward.add(leftover);
            rewardRate = reward.div(duration);
        }
        currentRewards = reward;
        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(duration);
        emit RewardAdded(reward);
    }
}
