import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { loadFixture, fixtureDefault } from "../utils/fixturesVelo";
import { AddressZero, MAX } from "../utils/constants";
import { increaseBlock, increaseTime, getTimestamp } from "../utils/helper";

const ONE_WEEK = 60 * 60 * 24 * 7;
const user1StakeAmount = ethers.utils.parseEther("1000"); // 1k
const user2StakeAmount = ethers.utils.parseEther("5000"); // 5k

describe("Loopfi for Velodrome", function () {
  let accounts: Signer[];
  let doubleVoter: Contract;
  let lpDepositor: Contract;
  let LPF: Contract;
  let lpfLocker: Contract;
  let owner: Signer;
  let stakingRewards: Contract;
  let tokenId: any;
  let treasury: Contract;
  let USXDFLP: Contract;
  let veDistributor: Contract;
  let VELO: Contract;
  let veloMiner: Contract;
  let VELOOPLP: Contract;
  let veVELO: Contract;
  let veDepositor: Contract;

  before(async function () {
    ({
      accounts,
      doubleVoter,
      lpDepositor,
      LPF,
      lpfLocker,
      owner,
      stakingRewards,
      tokenId,
      treasury,
      USXDFLP,
      VELO,
      veloMiner,
      VELOOPLP,
      veDepositor,
      veDistributor,
      veVELO,
    } = await loadFixture(fixtureDefault));
  });

  describe("Staking Rewards", function () {
    it("stake pVelo", async function () {
      const user1 = await accounts[1];
      const user1Address = await user1.getAddress();

      const user2 = await accounts[2];
      const user2Address = await user2.getAddress();

      // Velo approves to pVelo.
      await VELO.connect(user1).approve(veDepositor.address, MAX);
      await VELO.connect(user2).approve(veDepositor.address, MAX);

      // Deposit to get pVelo.
      await veDepositor.connect(user1).depositTokens(user1StakeAmount);
      await veDepositor.connect(user2).depositTokens(user2StakeAmount);

      // Approve to staking reward contract to stake.
      await veDepositor.connect(user1).approve(stakingRewards.address, MAX);
      await veDepositor.connect(user2).approve(stakingRewards.address, MAX);

      await expect(() =>
        stakingRewards.connect(user1).stake(user1StakeAmount)
      ).to.changeTokenBalances(
        veDepositor,
        [user1, stakingRewards],
        [user1StakeAmount.mul(-1), user1StakeAmount]
      );
      await expect(() =>
        stakingRewards.connect(user2).stake(user2StakeAmount)
      ).to.changeTokenBalances(
        veDepositor,
        [user2, stakingRewards],
        [user2StakeAmount.mul(-1), user2StakeAmount]
      );
    });

    it("Transfer rewards to distribute", async function () {
      const user10 = await accounts[10];
      const user10Address = await user10.getAddress();
      const rewardAmount = ethers.utils.parseEther("6000"); // 6k

      await VELO.connect(user10).transfer(stakingRewards.address, rewardAmount);
      await LPF.connect(user10).transfer(stakingRewards.address, rewardAmount);

      let veloRewardDetails = await stakingRewards.rewardData(VELO.address);

      // Have not distribute rewards, so the rate should be 0.
      expect(veloRewardDetails.rewardRate).to.eq(0);
      let lpfRewardDetails = await stakingRewards.rewardData(LPF.address);

      // Have not distribute rewards, so the rate should be 0.
      expect(lpfRewardDetails.rewardRate).to.eq(0);

      // The first time to get rewards to distribute rewards.
      await stakingRewards.connect(user10).getReward();

      veloRewardDetails = await stakingRewards.rewardData(VELO.address);

      // Have distributed rewards, so the rate should be greater than 0.
      expect(veloRewardDetails.rewardRate).to.not.eq(0);
      lpfRewardDetails = await stakingRewards.rewardData(LPF.address);

      // Have distributed rewards, so the rate should be greater than 0.
      expect(lpfRewardDetails.rewardRate).to.not.eq(0);

      // Mine some blocks to distribute rewards.
      await increaseTime(10);
      await increaseBlock(10);
    });

    it("Get rewards", async function () {
      const user1 = await accounts[1];
      const user1Address = await user1.getAddress();

      const user2 = await accounts[2];
      const user2Address = await user2.getAddress();

      // Mine blocks to pass the reward duration.
      await increaseTime(ONE_WEEK);
      await increaseBlock(10);

      const user1EarnedVelo = await stakingRewards.earned(
        user1Address,
        VELO.address
      );

      const user2EarnedVelo = await stakingRewards.earned(
        user2Address,
        VELO.address
      );

      const user1EarnedLpf = await stakingRewards.earned(
        user1Address,
        LPF.address
      );

      const user2EarnedLpf = await stakingRewards.earned(
        user2Address,
        LPF.address
      );

      expect(user2EarnedVelo.div(user1EarnedVelo)).to.eq(
        user2StakeAmount.div(user1StakeAmount)
      );
      expect(user2EarnedLpf.div(user1EarnedLpf)).to.eq(
        user2StakeAmount.div(user1StakeAmount)
      );
      expect(
        user2EarnedVelo.mul(1000).div(user2EarnedLpf).toNumber()
      ).to.closeTo(52000, 10);
    });

    it("Exit", async function () {
      const user1 = await accounts[1];
      const user1Address = await user1.getAddress();

      const user2 = await accounts[2];
      const user2Address = await user2.getAddress();

      await expect(() =>
        stakingRewards.connect(user1).exit()
      ).to.changeTokenBalances(
        veDepositor,
        [user1, stakingRewards],
        [user1StakeAmount, user1StakeAmount.mul(-1)]
      );
      await expect(() =>
        stakingRewards.connect(user2).exit()
      ).to.changeTokenBalances(
        veDepositor,
        [user2, stakingRewards],
        [user2StakeAmount, user2StakeAmount.mul(-1)]
      );

      // The second time to get rewards to distribute rewards.
      await stakingRewards.getReward();
    });
  });
});
