import { ethers } from "hardhat";
import { Signer, Contract } from "ethers";
import { AddressZero, MAX } from "./utils/constants";
import {
  loadFixture,
  fixtureDefault,
  faucetToken,
} from "./utils/fixturesSaddle";
import { increaseBlock, increaseTime, getTimestamp } from "./utils/helper";

import { expect } from "chai";

const ONE_WEEK = 60 * 60 * 24 * 7;

describe("LPFLocker", function () {
  let accounts: Signer[];
  let owner: Signer;
  let booster: Contract;
  let LPF: Contract;
  let LPFStaking: Contract;
  let locker: Contract;
  let SDL: Contract;
  let pSDL: Contract;
  let LPFVirtualRewardPool: Contract;
  let LPFStakingProxy: Contract;
  let depositor: Contract;
  let pSDLStaking: Contract;
  let saddleD4: Contract;
  let treasury: Contract;
  let lockerExtraReward: Contract;

  before(async function () {
    ({
      accounts,
      booster,
      depositor,
      SDL,
      LPF,
      LPFStaking,
      LPFVirtualRewardPool,
      LPFStakingProxy,
      locker,
      pSDL,
      pSDLStaking,
      treasury,
      lockerExtraReward,
      owner,
    } = await loadFixture(fixtureDefault));
  });

  describe("LPF Reward Pool", function () {
    it("1. Stake LPF", async function () {
      const user1 = accounts[0];
      const user1Address = await user1.getAddress();
      const faucetAmount = ethers.utils.parseEther("10000"); // 10k
      const stakeAmount = ethers.utils.parseEther("500");

      // await LPF.mint(user1Address, faucetAmount);
      await faucetToken("LPF", user1Address, faucetAmount);

      // Approve to LPF staking contract.
      await LPF.connect(user1).approve(LPFStaking.address, MAX);

      // Stake LPF in LPF staking contract.
      await expect(() =>
        LPFStaking.connect(user1).stake(stakeAmount)
      ).to.changeTokenBalances(
        LPF,
        [user1, LPFStaking],
        [stakeAmount.mul(-1), stakeAmount]
      );
    });

    it("2. Get base rewards.", async function () {
      const user1 = accounts[0];
      const user1Address = await user1.getAddress();

      // This is the first time to set reward rate.
      // So reward rate should be zero.
      expect(await LPFStaking.rewardRate()).to.eq("0");
      expect(await LPFStaking.periodFinish()).to.eq("0");

      // Trigger earmark in booster contract to set reward rate.
      const depositAmount = ethers.utils.parseEther("1000");

      await depositor
        .connect(user1)
        ["deposit(uint256,bool,address)"](
          depositAmount,
          true,
          pSDLStaking.address
        );

      saddleD4 = await faucetToken(
        "saddleD4",
        await user1.getAddress(),
        depositAmount
      );

      await saddleD4
        .connect(user1)
        .approve(booster.address, ethers.constants.MaxInt256);

      await booster.connect(user1).depositAll(0, true);

      const faucetRewardAmount = ethers.utils.parseEther("10000");

      // await SDL.mint(LPFStaking.address, faucetRewardAmount);
      // await LPFStaking.queueNewRewards(faucetRewardAmount);
      await faucetToken("SDL", user1Address, faucetRewardAmount);

      // Mine blocks to get rewards.
      await increaseTime(100);
      await increaseBlock(100);

      await booster.earmarkRewards(0);

      // It the first time to distribute rewards
      const rewards = await SDL.balanceOf(LPFStaking.address);

      const queuedRewards = await LPFStaking.queuedRewards();
      const duration = await LPFStaking.duration();
      const expectRewardRate = queuedRewards.add(rewards).div(duration);
      expect(expectRewardRate).to.eq(await LPFStaking.rewardRate());

      const beforeUser1EarnedRewardAmount = await LPFStaking.earned(
        user1Address
      );

      // Mine some blocks to earn rewards
      await increaseBlock(10);
      await increaseTime(10);

      const afterUser1EarnedRewardAmount = await LPFStaking.earned(
        user1Address
      );
      expect(afterUser1EarnedRewardAmount).to.gt(0);
      expect(afterUser1EarnedRewardAmount).to.gt(beforeUser1EarnedRewardAmount);

      const beforeUser1RewardAmount = await pSDL.balanceOf(user1Address);

      // Only claim default reward.
      await LPFStaking.connect(user1)["getReward(address,bool,bool)"](
        user1Address,
        false,
        false
      );

      const afterUser1RewardAmount = await pSDL.balanceOf(user1Address);

      // When gets reward, will deposit it to reward token depositor contract
      // In this case, only get rewards, do not stake.
      expect(afterUser1RewardAmount).to.gt(beforeUser1RewardAmount);
    });

    it("3. Only withdraw LPF", async function () {
      const user1 = accounts[0];
      const withdrawAmount = ethers.utils.parseEther("100");

      // Only withdraw LPF, do not get rewards
      await expect(() =>
        LPFStaking.connect(user1).withdraw(withdrawAmount, false)
      ).to.changeTokenBalance(LPF, user1, withdrawAmount);
    });

    it("4. Get extra rewards", async function () {
      // Should have an extra reward.
      expect(await LPFStaking.extraRewardsLength()).to.eq(1);

      const user1 = accounts[0];
      const user1Address = await user1.getAddress();
      // 4. Start to distribute extra rewards.
      const faucetVirtualRewardAmount = ethers.utils.parseEther("10000");
      // await LPF.mint(LPFVirtualRewardPool.address, faucetVirtualRewardAmount);
      await faucetToken(
        "LPF",
        LPFVirtualRewardPool.address,
        faucetVirtualRewardAmount
      );

      // This is the first time to set reward rate for virtual staking.
      // So the reward rate in it should be zero.
      expect(await LPFVirtualRewardPool.rewardRate()).to.eq(0);

      await LPFVirtualRewardPool.queueNewRewards(faucetVirtualRewardAmount);

      const virtualRewardDuration = await LPFVirtualRewardPool.duration();
      const expectedVirtualRewardRate = faucetVirtualRewardAmount.div(
        virtualRewardDuration
      );

      expect(expectedVirtualRewardRate).to.not.eq(0);
      expect(await LPFVirtualRewardPool.rewardRate()).to.eq(
        expectedVirtualRewardRate
      );

      // Mine some blocks to get virtual rewards.
      const mintBlocks = 10;
      await increaseBlock(mintBlocks);
      await increaseTime(mintBlocks);

      const user1EarnedExtraRewardAmount = await LPFVirtualRewardPool.earned(
        user1Address
      );
      const user1ExpectedEarnedExtraRewardAmount =
        expectedVirtualRewardRate.mul(mintBlocks);
      expect(user1EarnedExtraRewardAmount).to.closeTo(
        user1ExpectedEarnedExtraRewardAmount,
        500
      );

      // Get all rewards, including base reward and virtual reward.
      const beforeUser1BaseRewardBalance = await pSDL.balanceOf(user1Address);
      const beforeUser1ExtraRewardBalance = await LPF.balanceOf(user1Address);

      await LPFStaking.connect(user1)["getReward(address,bool,bool)"](
        user1Address,
        true,
        false
      );

      const afterUser1BaseRewardBalance = await pSDL.balanceOf(user1Address);
      const afterUser1ExtraRewardBalance = await LPF.balanceOf(user1Address);

      expect(afterUser1BaseRewardBalance).gt(beforeUser1BaseRewardBalance);
      expect(afterUser1ExtraRewardBalance).gt(beforeUser1ExtraRewardBalance);
    });

    it("5. Extend rewards", async function () {
      // const newRewardsAmount = ethers.utils.parseEther("500");
      // await SDL.mint(LPFStaking.address, newRewardsAmount);

      const beforeBaseRewardRate = await LPFStaking.rewardRate();
      // await LPFStaking.queueNewRewards(newRewardsAmount);
      await booster.earmarkRewards(0);

      const afterBaseRewardRate = await LPFStaking.rewardRate();
      expect(afterBaseRewardRate).to.gt(beforeBaseRewardRate);
    });
  });

  describe("LPF Locker", async function () {
    it("1. Lock LPF without donating", async function () {
      const user1 = accounts[0];
      const user1Address = await user1.getAddress();
      const lockAmount = ethers.utils.parseEther("500");

      const user2 = accounts[1];
      const user2Address = await user2.getAddress();
      const faucetAmount = ethers.utils.parseEther("10000"); // 10k

      // await LPF.mint(user2Address, faucetAmount);
      await faucetToken("LPF", user2Address, faucetAmount);

      // User1 approves to locker contract.
      await LPF.connect(user1).approve(locker.address, MAX);
      // User2 approves to LPF staking contract.
      await LPF.connect(user2).approve(locker.address, MAX);

      const beforeLPFStakingLPFBalance = await LPFStaking.balanceOf(
        LPFStakingProxy.address
      );

      // Before the first one locks LPF, there should be only one epoch.
      expect(await locker.epochCount()).to.eq(1);

      const beforeWeight = await locker.balanceOf(user1Address);
      // Lock LPF.
      await expect(() =>
        locker.connect(user1).lock(user1Address, lockAmount, 0)
      ).to.changeTokenBalances(
        LPF,
        [user1, LPFStaking],
        [lockAmount.mul(-1), lockAmount]
      );
      await expect(() =>
        locker.connect(user2).lock(user2Address, lockAmount, 0)
      ).to.changeTokenBalances(
        LPF,
        [user2, LPFStaking],
        [lockAmount.mul(-1), lockAmount]
      );

      // After the first one locks LPF, notice it does not enter the next epoch,
      // but should be two epoches.
      expect(await locker.epochCount()).to.eq(2);

      await increaseTime(ONE_WEEK);
      await increaseBlock(10);

      const afterWeight = await locker.balanceOf(user1Address);
      // The voting power should increase
      expect(afterWeight.sub(beforeWeight)).to.eq(lockAmount);

      const afterLPFStakingLPFBalance = await LPFStaking.balanceOf(
        LPFStakingProxy.address
      );
      expect(afterLPFStakingLPFBalance.sub(beforeLPFStakingLPFBalance)).to.eq(
        lockAmount.mul(2)
      );
    });

    it("2. Get base rewards", async function () {
      const user1 = accounts[0];
      const user1Address = await user1.getAddress();
      // Have not gotten rewards, so reward rate should be 0.
      const baseRewardToken = await locker.rewardTokens(0);
      let rewardData = await locker.rewardData(baseRewardToken);

      expect(rewardData.rewardRate).to.eq(0);

      // Mine some blocks to earn rewards from LPF staking contract.
      await increaseBlock(10);
      await increaseTime(10);

      expect(await LPFStaking.earned(LPFStakingProxy.address)).to.gt(0);
      // Reward is not zero, so trigger incentive should be greater than 0.
      expect(await LPFStakingProxy.callStatic.distribute()).to.gt(0);

      // Get rewards and distribute them.
      await LPFStakingProxy.distribute();

      // So now, reward rate should not be zero.
      rewardData = await locker.rewardData(baseRewardToken);
      expect(rewardData.rewardRate).to.not.eq(0);

      // Mine some blocks to earn rewards from LPF locker contract.
      await increaseBlock(10);
      await increaseTime(10);

      const user1ClaimableRewards = await locker.claimableRewards(user1Address);
      // console.log("user1ClaimableRewards", user1ClaimableRewards);
      expect(user1ClaimableRewards[0].amount).to.gt(0);

      // User1 only gets rewards.
      const beforeUser1BaseRewardBalance = await pSDL.balanceOf(user1Address);
      await locker["getReward(address,bool)"](user1Address, false);
      const afterUser1BaseRewardBalance = await pSDL.balanceOf(user1Address);

      expect(afterUser1BaseRewardBalance).to.gt(beforeUser1BaseRewardBalance);
    });

    it("3. Lock LPF with donating", async function () {
      const user1 = accounts[0];
      const user1Address = await user1.getAddress();
      const lockAmount = ethers.utils.parseEther("5");
      const spendRatio = 100;
      const donateAmount = lockAmount.mul(100).div(10000);
      const boostPayment = await locker.boostPayment();

      const beforeBoostPaymentLPFBalance = await LPF.balanceOf(boostPayment);

      const beforeUser1LockedBalances = await locker.lockedBalances(
        user1Address
      );

      const beforeUser1Balances = await locker.balances(user1Address);

      // Lock LPF.
      await locker.connect(user1).lock(user1Address, lockAmount, spendRatio);

      const afterUser1Balances = await locker.balances(user1Address);
      expect(afterUser1Balances.locked.sub(beforeUser1Balances.locked)).to.eq(
        lockAmount.sub(donateAmount)
      );
      expect(afterUser1Balances.boosted).to.gt(afterUser1Balances.locked);

      const afterUser1LockedBalances = await locker.lockedBalances(
        user1Address
      );
      expect(
        afterUser1LockedBalances.total.sub(beforeUser1LockedBalances.total)
      ).to.eq(lockAmount.sub(donateAmount));

      const afterBoostPaymentLPFBalance = await LPF.balanceOf(boostPayment);
      expect(afterBoostPaymentLPFBalance.sub(donateAmount)).to.eq(
        beforeBoostPaymentLPFBalance
      );
    });

    it("4. Get extra rewards", async function () {
      const user1 = accounts[0];
      const user1Address = await user1.getAddress();
      const user2 = accounts[1];
      const user2Address = await user2.getAddress();
      const ownerAddress = await owner.getAddress();

      // Mine blocks to epoch 2 to add extra rewards.
      await increaseTime(ONE_WEEK);
      await increaseBlock(10);

      const currentTime = await getTimestamp();
      const currentEpoch = await locker.findEpochId(currentTime);
      expect(currentEpoch).to.eq(2);

      const faucetAmount = ethers.utils.parseEther("500");
      // await LPF.mint(user1Address, faucetAmount);
      await faucetToken("LPF", ownerAddress, faucetAmount);

      await LPF.approve(lockerExtraReward.address, MAX);

      await expect(() =>
        lockerExtraReward.addReward(LPF.address, faucetAmount)
      ).to.changeTokenBalance(LPF, lockerExtraReward, faucetAmount);

      // Mine blocks to enter epoch 3 to get extra rewards.
      await increaseTime(ONE_WEEK);
      await increaseBlock(10);
      // Update locker epoch to the newest state.
      await locker.checkpointEpoch();

      const user1ClaimableRewards =
        await lockerExtraReward.claimableRewardsAtEpoch(
          user1Address,
          LPF.address,
          1
        );
      await expect(() =>
        lockerExtraReward.getReward(user1Address, LPF.address)
      ).to.changeTokenBalance(LPF, user1, user1ClaimableRewards);

      const user2ClaimableRewards =
        await lockerExtraReward.claimableRewardsAtEpoch(
          user2Address,
          LPF.address,
          1
        );
      await expect(() =>
        lockerExtraReward.getReward(user2Address, LPF.address)
      ).to.changeTokenBalance(LPF, user2, user2ClaimableRewards);
    });

    it("5. Only withdraw LPF", async function () {
      const user1 = accounts[0];
      const user1Address = await user1.getAddress();

      // Do not have unlock token.
      let user1LockedBalances = await locker.lockedBalances(user1Address);
      expect(user1LockedBalances.unlockable).to.eq(0);

      const currentTime = await getTimestamp();
      const passTime = user1LockedBalances.lockData[0].unlockTime - currentTime;

      // Pass the whole lock duration.
      await increaseTime(passTime);
      await increaseBlock(10);

      // Should have unlock token.
      user1LockedBalances = await locker.lockedBalances(user1Address);
      expect(user1LockedBalances.unlockable).to.gt(0);
      expect(
        user1LockedBalances.unlockable.add(user1LockedBalances.locked)
      ).to.eq(user1LockedBalances.total);

      // Withdraw LPF token.
      await expect(() =>
        locker.connect(user1).processExpiredLocks(false)
      ).to.changeTokenBalance(LPF, user1, user1LockedBalances.unlockable);

      // Should have no unlock token.
      user1LockedBalances = await locker.lockedBalances(user1Address);
      expect(user1LockedBalances.unlockable).eq(0);
    });
  });
});
