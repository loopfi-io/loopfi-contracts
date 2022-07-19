import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, Contract } from "ethers";

import {
  loadFixture,
  fixtureL2,
  earmarkAndForwardRewards,
} from "./utils/fixtures";
import { MAX } from "./utils/constants";
import { increaseBlock, increaseTime } from "./utils/helper";

describe("pDF Staking Pool", function () {
  let accounts: Signer[];
  let df: Contract;
  let depositor: Contract;
  let depositorL2: Contract;
  let depositProxyL2: Contract;
  let booster: Contract;
  let boosterL2: Contract;
  let stakingPoolL2: Contract;
  let treasury: Contract;

  async function init() {
    ({
      accounts,
      booster,
      boosterL2,
      df,
      depositor,
      depositorL2,
      stakingPoolL2,
      treasury,
    } = await loadFixture(fixtureL2));

    // // Set reward rate for base pool
    // const beforeRewardRateInBasePool = await stakingPoolL2.rewardRate();

    // // Claim the reward from the initial lock
    // await booster.earmarkRewards(0);
    // const afterRewardRateInBasePool = await stakingPoolL2.rewardRate();

    // expect(afterRewardRateInBasePool).to.not.eq(beforeRewardRateInBasePool);
  }

  it("Init", async function () {
    await init();
  });

  it("Should get rewards, after staking", async function () {
    const user1 = accounts[0];
    const uer1Address = await user1.getAddress();
    const depositAmount = ethers.utils.parseEther("1000"); // 1000

    // Approve depositorL2 contract.
    await df.connect(user1).approve(depositorL2.address, MAX);

    const unstakeDFAmount = await df.balanceOf(depositorL2.address);

    await expect(() =>
      depositorL2
        .connect(user1)
        ["deposit(uint256,bool,address)"](
          depositAmount,
          true,
          stakingPoolL2.address
        )
    ).to.changeTokenBalance(
      stakingPoolL2,
      user1,
      depositAmount.add(unstakeDFAmount)
    );
    await depositor.lockDF();

    // Mine blocks.
    await increaseBlock(500);
    await increaseTime(500);

    const beforeTreasuryDFBalance = await df.balanceOf(treasury.address);

    // earmark again to get the latest reward
    await earmarkAndForwardRewards(booster);
    await boosterL2.earmarkRewards(0);

    // should send some rewards to the treasury contract
    const afterTreasuryDFBalance = await df.balanceOf(treasury.address);
    expect(afterTreasuryDFBalance.sub(beforeTreasuryDFBalance)).to.gt(0);

    // Get rewards
    const beforeUser1DFBalance = await df.balanceOf(uer1Address);
    // const beforeUser1LPFBalance = await lpf.balanceOf(uer1Address);

    await stakingPoolL2.connect(user1)["getReward(bool)"](false);

    const afterUser1DFBalance = await df.balanceOf(uer1Address);
    // const afterUser1LPFBalance = await lpf.balanceOf(uer1Address);

    expect(afterUser1DFBalance).to.gt(beforeUser1DFBalance);
    // expect(afterUser1LPFBalance).to.gt(beforeUser1LPFBalance);
  });

  it("Should revert when users try to withdraw funds from treasury", async function () {
    const user1 = accounts[0];
    const uer1Address = await user1.getAddress();
    const withdrawAmount = ethers.utils.parseEther("1");

    expect(await df.balanceOf(treasury.address)).to.gt(0);

    await expect(
      treasury
        .connect(user1)
        .withdrawTo(df.address, withdrawAmount, uer1Address)
    ).to.be.revertedWith("onlyOwner: caller is not the owner");
  });

  it("Should withdraw funds by the operator account correctly", async function () {
    const user1 = accounts[0];
    const uer1Address = await user1.getAddress();
    const withdrawAmount = ethers.utils.parseEther("2");

    expect(await df.balanceOf(treasury.address)).to.gt(withdrawAmount);

    await expect(() =>
      treasury.withdrawTo(df.address, withdrawAmount, uer1Address)
    ).to.changeTokenBalance(df, user1, withdrawAmount);
  });

  it("Should execute actions by the operator account correctly", async function () {
    const user1 = accounts[0];
    const uer1Address = await user1.getAddress();
    const transferAmount = ethers.utils.parseEther("1");

    const iface = new ethers.utils.Interface([
      "function transfer(address to, uint256 amount)",
    ]);
    const data = iface.encodeFunctionData("transfer", [
      uer1Address,
      transferAmount,
    ]);

    await expect(() =>
      treasury.execute(df.address, 0, data)
    ).to.changeTokenBalance(df, user1, transferAmount);
  });

  it("Should revert when users try to withdraw funds from treasury", async function () {
    const user1 = accounts[0];
    const uer1Address = await user1.getAddress();
    const transferAmount = ethers.utils.parseEther("3");

    const iface = new ethers.utils.Interface([
      "function transfer(address to, uint256 amount)",
    ]);
    const data = iface.encodeFunctionData("transfer", [
      uer1Address,
      transferAmount,
    ]);

    await expect(
      treasury.connect(user1).execute(df.address, 0, data)
    ).to.be.revertedWith("onlyOwner: caller is not the owner");
  });

  it("Should trigger to get rewards for L2 depositorL2", async function () {
    const user1 = accounts[0];
    const uer1Address = await user1.getAddress();
    const depositAmount = ethers.utils.parseEther("1000"); // 1000

    await expect(() =>
      depositorL2
        .connect(user1)
        ["deposit(uint256,bool,address)"](
          depositAmount,
          true,
          stakingPoolL2.address
        )
    ).to.changeTokenBalance(stakingPoolL2, user1, depositAmount);
    await depositor.lockDF();

    // Mine blocks.
    await increaseBlock(500);
    await increaseTime(500);

    // Get L2 rewards
    await earmarkAndForwardRewards(booster);
    const l2CounterParty = await booster.l2CounterParty();
    const l2CounterPartyDFBalance = await df.balanceOf(l2CounterParty);
    expect(l2CounterPartyDFBalance).to.gt("0");

    // Distribute L2 rewards
    await boosterL2.earmarkRewards(0);

    // Get rewards
    const beforeUser1DFBalance = await df.balanceOf(uer1Address);
    // const beforeUser1LPFBalance = await lpf.balanceOf(uer1Address);

    await stakingPoolL2.connect(user1)["getReward(bool)"](true);

    const afterUser1DFBalance = await df.balanceOf(uer1Address);
    // const afterUser1LPFBalance = await lpf.balanceOf(uer1Address);

    expect(afterUser1DFBalance).to.gt(beforeUser1DFBalance);
    // expect(afterUser1LPFBalance).to.gt(beforeUser1LPFBalance);
  });
});
