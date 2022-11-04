import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { loadFixture, fixtureDefault } from "../utils/fixturesVelo";
import { MAX } from "../utils/constants";
import { increaseBlock, increaseTime, getTimestamp } from "../utils/helper";

const ONE_DAY = 60 * 60 * 24;
const ONE_WEEK = 60 * 60 * 24 * 7;

describe("Loopfi for Velodrome", function () {
  let accounts: Signer[];
  let doubleVoter: Contract;
  let treasury: Contract;
  let lpDepositor: Contract;
  let lpfLocker: Contract;
  let LPF: Contract;
  let OP: Contract;
  let owner: Signer;
  let Router: Contract;
  let tokenId: any;
  let USXDFLP: Contract;
  let USXDFVirtualRewardPool: Contract;
  let veDistributor: Contract;
  let VELOOPLP: Contract;
  let VELO: Contract;
  let veloMiner: Contract;
  let veVELO: Contract;
  let veDepositor: Contract;
  let voter: Contract;

  before(async function () {
    ({
      accounts,
      doubleVoter,
      treasury,
      lpDepositor,
      lpfLocker,
      LPF,
      OP,
      owner,
      Router,
      tokenId,
      USXDFLP,
      USXDFVirtualRewardPool,
      veDepositor,
      veDistributor,
      VELO,
      VELOOPLP,
      veloMiner,
      veVELO,
      voter,
    } = await loadFixture(fixtureDefault));
  });

  describe("LpDepositor", function () {
    it("Preparation", async function () {
      const depositAmount = ethers.utils.parseEther("100");
      // Deposit LP
      const user2 = accounts[2];
      const user2Address = await user2.getAddress();
      // Distribute rewards
      const user10 = accounts[10];
      const user10Address = await user10.getAddress();

      // Deposit LP firstly to get later bribe rewards
      await expect(() =>
        lpDepositor.connect(user2).deposit(VELOOPLP.address, depositAmount)
      ).to.changeTokenBalance(VELOOPLP, user2, depositAmount.mul(-1));

      // Get gauge contract address of the velo-op lp.
      const VELOOPGaugeAddress = await lpDepositor.gaugeForPool(
        VELOOPLP.address
      );
      // Initialize gauge contract of the velo-op lp.
      const VELOOPGauge = await ethers.getContractAt(
        "IGauge",
        VELOOPGaugeAddress
      );

      // Get bribe contract address the velo-op lp.
      const VELOOPBribeAddress = await lpDepositor.bribeForPool(
        VELOOPLP.address
      );
      // Initialize bribe contract the velo-op lp.
      const VELOOPBribe = await ethers.getContractAt(
        "IBribe",
        VELOOPBribeAddress
      );

      const beforeBribeRewardsListLength =
        await VELOOPBribe.rewardsListLength();
      // 1. Distribute reward for the bribe contract.
      const bribeRewardAmount = ethers.utils.parseEther("1000");
      const rewardToken = LPF;
      await rewardToken.connect(user10).approve(VELOOPBribe.address, MAX);
      await VELOOPBribe.connect(user10).notifyRewardAmount(
        rewardToken.address,
        bribeRewardAmount
      );

      const afterBribeRewardsListLength = await VELOOPBribe.rewardsListLength();
      // Should add a new reward token
      expect(
        afterBribeRewardsListLength.sub(beforeBribeRewardsListLength)
      ).to.eq(1);

      const newRewardToken = await VELOOPBribe.rewards(
        afterBribeRewardsListLength.sub(1)
      );
      // New reward token should be the reward token has been added.
      expect(newRewardToken).to.eq(rewardToken.address);

      // This is the first time to vote.
      const beforeVotedWeight = await voter.usedWeights(tokenId);
      // So the voted weight should be 0.
      expect(beforeVotedWeight).to.eq(0);

      // 2.Vote to get later bribe rewards.
      await voter
        .connect(user10)
        ["vote(uint256,address[],uint256[])"](
          tokenId,
          [VELOOPLP.address],
          [200]
        );

      const afterVotedWeight = await voter.usedWeights(tokenId);
      const tokenIdBalance = await veVELO.balanceOfNFT(tokenId);
      // All voting power has been voted.
      expect(afterVotedWeight).to.eq(tokenIdBalance);
      // The voted weight should be greater than 0 after voting.
      expect(afterVotedWeight).to.gt(beforeVotedWeight);

      // 3. Swap to generate some fees.
      const swapAmount = ethers.utils.parseEther("5000");
      const deadline = await getTimestamp();
      await OP.connect(user10).approve(Router.address, MAX);
      await Router.connect(user10).swapExactTokensForTokens(
        swapAmount,
        0, // amountOutMin
        [{ from: OP.address, to: VELO.address, stable: 0 }], // tuple[]
        user10Address, // to
        deadline + 100
      );
    });

    it("Deposit LP", async function () {
      const user1 = accounts[1];
      const user1Address = await user1.getAddress();
      const depositAmount = ethers.utils.parseEther("1000");

      // const user2 = accounts[2];
      // const user2Address = await user2.getAddress();

      // // To get locker rewards later.
      // await expect(() =>
      //   lpDepositor.connect(user2).deposit(VELOOPLP.address, depositAmount)
      // ).to.changeTokenBalance(VELOOPLP, user2, depositAmount.mul(-1));

      const beforeUSXDFLPBalance = await lpDepositor.totalBalances(
        USXDFLP.address
      );

      await expect(() =>
        lpDepositor.connect(user1).deposit(USXDFLP.address, depositAmount)
      ).to.changeTokenBalance(USXDFLP, user1, depositAmount.mul(-1));

      const afterUSXDFLPBalance = await lpDepositor.totalBalances(
        USXDFLP.address
      );
      expect(afterUSXDFLPBalance.sub(beforeUSXDFLPBalance)).to.eq(
        depositAmount
      );
    });

    it("Claim rewards from depositing USXDF LP tokens: VELO", async function () {
      const user1 = accounts[1];
      const user1Address = await user1.getAddress();

      // Mine some blocks to get rewards.
      await increaseTime(ONE_WEEK);
      await increaseBlock(100);
      // Check point in veVELO
      await veVELO.checkpoint();

      let pendingRewardsAmount = await lpDepositor.pendingRewards(
        user1Address,
        [USXDFLP.address]
      );

      await expect(() =>
        lpDepositor.connect(user1).getReward([USXDFLP.address])
      ).to.changeTokenBalance(VELO, user1, pendingRewardsAmount[0].velo);

      pendingRewardsAmount = await lpDepositor.pendingRewards(user1Address, [
        USXDFLP.address,
      ]);

      expect(pendingRewardsAmount[0].velo).to.eq(0);
    });

    it("Withdraw some LP", async function () {
      const user1 = accounts[1];
      const user1Address = await user1.getAddress();
      const withdrawAmount = ethers.utils.parseEther("100");

      const beforeUSXDFLPBalance = await lpDepositor.totalBalances(
        USXDFLP.address
      );

      await expect(() =>
        lpDepositor.connect(user1).withdraw(USXDFLP.address, withdrawAmount)
      ).to.changeTokenBalance(USXDFLP, user1, withdrawAmount);

      const afterUSXDFLPBalance = await lpDepositor.totalBalances(
        USXDFLP.address
      );
      expect(beforeUSXDFLPBalance.sub(afterUSXDFLPBalance)).to.eq(
        withdrawAmount
      );
    });

    it("Get extra reward: LPF", async function () {
      const user1 = accounts[1];
      const user1Address = await user1.getAddress();
      const user10 = accounts[10];
      const rewardAmount = ethers.utils.parseEther("10000");
      // Transfer rewards to virtual reward pool to distribute.
      await LPF.connect(user10).transfer(
        USXDFVirtualRewardPool.address,
        rewardAmount
      );

      // Set reward rate.
      await USXDFVirtualRewardPool.queueNewRewards(rewardAmount);
      const rewardRate = await USXDFVirtualRewardPool.rewardRate();

      expect(rewardRate).to.not.eq(0);

      let earned = await USXDFVirtualRewardPool.earned(user1Address);
      expect(earned).to.eq(0);

      // Mine blocks to get rewards.
      await increaseTime(ONE_WEEK);
      await increaseBlock(10);

      earned = await USXDFVirtualRewardPool.earned(user1Address);
      expect(earned).to.not.eq(0);

      const pendingRewardsAmount = await lpDepositor.pendingRewards(
        user1Address,
        [USXDFLP.address]
      );
      const beforeUser1LPFBalance = await LPF.balanceOf(user1Address);
      await expect(() =>
        lpDepositor.connect(user1).getReward([USXDFLP.address])
      ).to.changeTokenBalance(VELO, user1, pendingRewardsAmount[0].velo);

      const afterUser1LPFBalance = await LPF.balanceOf(user1Address);
      expect(afterUser1LPFBalance.sub(beforeUser1LPFBalance)).to.gt(earned);

      earned = await USXDFVirtualRewardPool.earned(user1Address);
      expect(earned).to.eq(0);
    });

    it("Claim locker rewards from bribe: LPF", async function () {
      const user10 = accounts[10];
      const user10Address = await user10.getAddress();

      // Get internal bribe contract address the velo-op lp.
      const VELOOPInternalBribeAddress = await lpDepositor.internalBribeForPool(
        VELOOPLP.address
      );
      const VELOOPInternalBribe = await ethers.getContractAt(
        "IBribe",
        VELOOPInternalBribeAddress
      );

      const rewardToken = OP;
      const bribeRewardAmount = ethers.utils.parseEther("1000");
      const beforeInternalBribeRewardsPeriodFinish =
        await VELOOPInternalBribe.periodFinish(rewardToken.address);

      // Distribute reward for the internal bribe contract.
      await rewardToken
        .connect(user10)
        .approve(VELOOPInternalBribe.address, MAX);
      await VELOOPInternalBribe.connect(user10).notifyRewardAmount(
        rewardToken.address,
        bribeRewardAmount
      );

      const afterInternalBribeRewardsPeriodFinish =
        await VELOOPInternalBribe.periodFinish(rewardToken.address);

      expect(afterInternalBribeRewardsPeriodFinish).to.gt(
        beforeInternalBribeRewardsPeriodFinish
      );

      // Mine blocks to enter the next epoch.
      await increaseTime(ONE_WEEK);
      await increaseBlock(10);

      const user2 = accounts[2];

      // Get gauge contract address of the velo-op lp.
      const VELOOPGaugeAddress = await lpDepositor.gaugeForPool(
        VELOOPLP.address
      );
      // Initialize gauge contract  of the velo-op lp.
      const VELOOPGauge = await ethers.getContractAt(
        "IGauge",
        VELOOPGaugeAddress
      );

      // Get bribe contract address of the velo-op lp.
      const VELOOPGaugeBribeAddress = await lpDepositor.bribeForPool(
        VELOOPLP.address
      );
      // Initialize bribe contract  of the velo-op lp.
      const VELOOPGaugeBribe = await ethers.getContractAt(
        "IBribe",
        VELOOPGaugeBribeAddress
      );

      const VELOOPGaugeRewardsLength = await VELOOPGauge.rewardsListLength();
      // Get gauge reward tokens.
      const VELOOPGaugeRewards = [];
      for (let i = 0; i < VELOOPGaugeRewardsLength.toNumber(); i++) {
        const VELOOPGaugeReward = await VELOOPGauge.rewards(i);
        if (VELOOPGaugeReward !== VELO.address) {
          const gaugeReward = await VELOOPGauge.earned(
            VELOOPGaugeReward,
            lpDepositor.address
          );
          // console.log(
          //   VELOOPGaugeReward,
          //   "gauge reward: ",
          //   gaugeReward.toString()
          // );
          VELOOPGaugeRewards.push(VELOOPGaugeReward);
        }
      }

      const VELOOPGaugeBribeRewardsLength =
        await VELOOPGaugeBribe.rewardsListLength();
      // Get bribe reward tokens.
      const VELOOPGaugeBribeRewards = [];
      for (let i = 0; i < VELOOPGaugeBribeRewardsLength.toNumber(); i++) {
        const VELOOPGaugeBribeReward = await VELOOPGaugeBribe.rewards(i);

        const bribeReward = await VELOOPGaugeBribe.earned(
          VELOOPGaugeBribeReward,
          tokenId
        );
        // console.log(
        //   VELOOPGaugeBribeReward,
        //   "bribe reward: ",
        //   bribeReward.toString()
        // );
        // const internalBribeReward = await VELOOPInternalBribe.earned(
        //   VELOOPGaugeBribeReward,
        //   tokenId
        // );
        // console.log(
        //   VELOOPGaugeBribeReward,
        //   "bribe reward: ",
        //   internalBribeReward.toString()
        // );
        VELOOPGaugeBribeRewards.push(VELOOPGaugeBribeReward);
      }

      const beforeTreasuryLPFBalance = await LPF.balanceOf(treasury.address);
      const beforeTreasuryOPBalance = await OP.balanceOf(treasury.address);

      // Claim locker rewards.
      await lpDepositor.connect(user2).claimLockerRewards(
        VELOOPLP.address, // pool
        VELOOPGaugeRewards, // gaugeRewards
        VELOOPGaugeBribeRewards // bribeRewards
      );

      const afterTreasuryLPFBalance = await LPF.balanceOf(treasury.address);
      const afterTreasuryOPBalance = await OP.balanceOf(treasury.address);

      // Should get bribe reward: LPF at here.
      expect(afterTreasuryLPFBalance).to.gt(beforeTreasuryLPFBalance);
      expect(afterTreasuryOPBalance).to.gt(beforeTreasuryOPBalance);
    });

    it("Claim locker rewards from gauge: OP", async function () {
      // Mine blocks to enter the next epoch.
      await increaseTime(ONE_WEEK);
      await increaseBlock(10);

      const user2 = accounts[2];
      const user10 = accounts[10];
      const user10Address = await user10.getAddress();

      // Get gauge contract address of the velo-op lp.
      const VELOOPGaugeAddress = await lpDepositor.gaugeForPool(
        VELOOPLP.address
      );
      // Initialize gauge contract  of the velo-op lp.
      const VELOOPGauge = await ethers.getContractAt(
        "IGauge",
        VELOOPGaugeAddress
      );

      // Get bribe contract address of the velo-op lp.
      const VELOOPGaugeBribeAddress = await lpDepositor.bribeForPool(
        VELOOPLP.address
      );
      // Initialize bribe contract  of the velo-op lp.
      const VELOOPGaugeBribe = await ethers.getContractAt(
        "IBribe",
        VELOOPGaugeBribeAddress
      );

      // Distribute reward for the gauge contract.
      const gaugeRewardAmount = ethers.utils.parseEther("1000");
      const gaugeRewardToken = OP;
      await gaugeRewardToken.connect(user10).approve(VELOOPGauge.address, MAX);
      await VELOOPGauge.connect(user10).notifyRewardAmount(
        gaugeRewardToken.address,
        gaugeRewardAmount
      );

      const afterGaugeRewardsListLength = await VELOOPGauge.rewardsListLength();
      const newGaugeRewardToken = await VELOOPGauge.rewards(
        afterGaugeRewardsListLength.sub(1)
      );
      // New reward token should be the reward token has been added.
      expect(newGaugeRewardToken).to.eq(gaugeRewardToken.address);

      // Mine blocks to get rewards.
      await increaseTime(ONE_WEEK);
      await increaseBlock(10);

      const VELOOPGaugeRewardsLength = await VELOOPGauge.rewardsListLength();
      // Get gauge reward tokens.
      const VELOOPGaugeRewards = [];
      for (let i = 0; i < VELOOPGaugeRewardsLength.toNumber(); i++) {
        const VELOOPGaugeReward = await VELOOPGauge.rewards(i);
        if (VELOOPGaugeReward !== VELO.address) {
          const gaugeReward = await VELOOPGauge.earned(
            VELOOPGaugeReward,
            lpDepositor.address
          );
          // console.log(
          //   VELOOPGaugeReward,
          //   "gauge reward: ",
          //   gaugeReward.toString()
          // );
          VELOOPGaugeRewards.push(VELOOPGaugeReward);
        }
      }

      const VELOOPGaugeBribeRewardsLength =
        await VELOOPGaugeBribe.rewardsListLength();
      // Get bribe reward tokens.
      const VELOOPGaugeBribeRewards = [];
      for (let i = 0; i < VELOOPGaugeBribeRewardsLength.toNumber(); i++) {
        const VELOOPGaugeBribeReward = await VELOOPGaugeBribe.rewards(i);

        const bribeReward = await VELOOPGaugeBribe.earned(
          VELOOPGaugeBribeReward,
          tokenId
        );
        // console.log(
        //   VELOOPGaugeBribeReward,
        //   "bribe reward: ",
        //   bribeReward.toString()
        // );
        VELOOPGaugeBribeRewards.push(VELOOPGaugeBribeReward);
      }

      const beforeTreasuryGaugeRewardTokenBalance1 =
        await gaugeRewardToken.balanceOf(treasury.address);

      // Can claim locker rewards from gauge.
      await lpDepositor.connect(user2).claimLockerRewards(
        VELOOPLP.address, // pool
        VELOOPGaugeRewards, // gaugeRewards
        VELOOPGaugeBribeRewards // bribeRewards
      );

      const afterTreasuryGaugeRewardTokenBalance =
        await gaugeRewardToken.balanceOf(treasury.address);

      // Should get gauge reward: OP at here.
      expect(afterTreasuryGaugeRewardTokenBalance).to.gt(
        beforeTreasuryGaugeRewardTokenBalance1
      );
    });
  });
});
