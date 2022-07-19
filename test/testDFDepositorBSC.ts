import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, Contract } from "ethers";

import { loadFixture, fixtureL2, claimAndLock } from "./utils/fixtures";
import { MAX, AddressZero } from "./utils/constants";
import { increaseBlock, increaseTime } from "./utils/helper";

describe("DF Depositor L2", function () {
  let accounts: Signer[];
  let df: Contract;
  let veDFEscrow: Contract;
  let voter: Contract;
  let booster: Contract;
  let depositor: Contract;
  let depositorL2: Contract;
  let stakingPoolL2: Contract;
  let extraPoolL2: Contract;
  let boosterL2: Contract;
  let lpfL2: Contract;
  let arbBridge: Contract;

  before(async function () {
    ({
      accounts,
      df,
      veDFEscrow,
      voter,
      lpfL2,
      booster,
      depositor,
      depositorL2,
      stakingPoolL2,
      extraPoolL2,
      boosterL2,
      arbBridge,
    } = await loadFixture(fixtureL2));
  });

  it("L2 - Should deposit df and bridge", async function () {
    const user1 = accounts[0];
    const depositAmount = ethers.utils.parseEther("1000"); // 1000

    // Approve depositor contract.
    await df.connect(user1).approve(depositorL2.address, MAX);

    const unstakeDFAmount = await df.balanceOf(depositorL2.address);

    const beforeDFBalance = await df.balanceOf(depositor.address);

    // Deposit df and bridge it into depositor

    await depositorL2
      .connect(user1)
      ["deposit(uint256,bool,address)"](
        depositAmount,
        true,
        stakingPoolL2.address
      );

    await depositor.claimFunds(
      0,
      ["0xecb9bdf346fa69c59c91e2aed20d585018bd0b9bbcadd2041f26d3ce4d196e35"],
      0,
      AddressZero,
      depositor.address,
      0,
      0,
      0,
      await df.balanceOf(arbBridge.address),
      "0x"
    );

    const afterDFBalance = await df.balanceOf(depositor.address);

    expect(afterDFBalance.sub(beforeDFBalance)).to.equal(
      depositAmount.add(unstakeDFAmount)
    );

    // const staked = await stakingPoolL2.balanceOf(await user1.getAddress());
    // console.log("staked", staked.toString());
  });

  it("L2 - Should fail if bridge less than threshold", async function () {
    const user1 = accounts[0];
    const depositAmount = ethers.utils.parseEther("1000"); // 1000

    const originalThreshold = await depositorL2.lockThreshold();
    await depositorL2.setLockThreshold(originalThreshold.mul(2));

    // Deposit df and bridge it into depositor
    await expect(
      depositorL2
        .connect(user1)
        ["deposit(uint256,bool,address)"](
          depositAmount,
          true,
          stakingPoolL2.address
        )
    ).to.revertedWith("amount does not reach the threshold!");

    // Restore the original threshold
    await depositorL2.setLockThreshold(originalThreshold);
  });

  it("Mainnet - Should lock df into veDF", async function () {
    const bal = await df.balanceOf(depositor.address);

    await expect(() => depositor.lockDF()).to.changeTokenBalance(
      df,
      depositor,
      bal.mul(-1)
    );
  });

  it("Mainnet - Should claim reward and bridge", async function () {
    // Mine blocks.
    await increaseTime(500);
    await increaseBlock(500);

    const reward = await veDFEscrow.callStatic.earnedInOne(voter.address);
    // console.log(reward.toString());

    const rewardForL2 = reward.sub(
      reward
        .mul(
          (await booster.forwardIncentive()).add(await booster.platformFee())
        )
        .div(await booster.FEE_DENOMINATOR())
    );
    // console.log(rewardForL2.toString());

    const beforeDFBalance = await df.balanceOf(booster.address);
    // const beforeLPFBalance = await lpf.balanceOf(depositProxyL2.address);
    await booster.earmarkRewards(0);

    const afterDFBalance = await df.balanceOf(booster.address);
    // const afterLPFBalance = await lpf.balanceOf(boosterL2.address);

    expect(afterDFBalance).to.gt(beforeDFBalance.add(rewardForL2));
    // expect(afterLPFBalance).to.gt(beforeLPFBalance);

    const actualReward = afterDFBalance.sub(
      afterDFBalance
        .mul(await booster.forwardIncentive())
        .div(await booster.FEE_DENOMINATOR())
    );

    await expect(() =>
      booster.forwardRewards(0, 0, "0x")
    ).to.changeTokenBalance(df, boosterL2, actualReward);
  });

  it("L2 - Should claim reward for user", async function () {
    const user1 = accounts[0];
    const user1Address = await user1.getAddress();

    await boosterL2.earmarkRewards(0);

    await increaseBlock(50);
    await increaseTime(50);

    const beforeDFBalance = await df.balanceOf(user1Address);
    const beforeLPFBalance = await lpfL2.balanceOf(user1Address);

    const rewardDF = await stakingPoolL2.earned(await user1.getAddress());
    const rewardRateDF = await stakingPoolL2.rewardRate();

    const rewardLPF = await extraPoolL2.earned(await user1.getAddress());
    const rewardRateLPF = await extraPoolL2.rewardRate();

    await stakingPoolL2.connect(user1)["getReward(bool)"](false);

    const afterDFBalance = await df.balanceOf(user1Address);
    const afterLPFBalance = await lpfL2.balanceOf(user1Address);

    expect(rewardRateDF).to.gt(0);
    expect(rewardRateLPF).to.gt(0);

    expect(afterDFBalance).to.gt(beforeDFBalance.add(rewardDF));
    expect(afterLPFBalance).to.gt(beforeLPFBalance.add(rewardLPF));
  });
});
