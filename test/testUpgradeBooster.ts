import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, Contract } from "ethers";
import { AddressZero, MAX } from "./utils/constants";
import { increaseBlock, increaseTime } from "./utils/helper";

import { loadFixture, fixtureL2, deployContract } from "./utils/fixtures";

describe("Update booster contract", function () {
  let accounts: Signer[];
  let df: Contract;
  let depositor: Contract;
  let depositorL2: Contract;
  let booster: Contract;
  let newBooster: Contract;
  let treasury: Contract;
  let voter: Contract;
  let arbBridge: Contract;
  let boosterL2: Contract;

  async function init() {
    ({
      accounts,
      booster,
      df,
      depositor,
      depositorL2,
      treasury,
      voter,
      arbBridge,
      boosterL2,
    } = await loadFixture(fixtureL2));
  }

  it("Init", async function () {
    await init();

    newBooster = await deployContract("Booster", [
      df.address,
      voter.address, // _staker
      arbBridge.address,
      arbBridge.address,
      boosterL2.address,
    ]);

    // --------- Configs -------------
    // Set treasury address in new booster contract
    await newBooster.setTreasury(treasury.address);
  });

  it("Should upgrade booster contract", async function () {
    const user1 = accounts[0];
    const depositAmount = ethers.utils.parseEther("1000"); // 1000

    await df.connect(user1).approve(depositorL2.address, MAX);

    // lock df to get rewards.
    await depositorL2.connect(user1)["deposit(uint256,bool,address)"](
      depositAmount,
      true,
      // baseRewardPool.address
      AddressZero
    );
    await depositor.lockDF();

    // Mine blocks.
    await increaseBlock(500);
    await increaseTime(500);

    let beforeTreasuryDFBalance = await df.balanceOf(treasury.address);

    let beforeBaseRewardPoolDFBalance = await df.balanceOf(booster.address);

    // earmark to get the reward.
    await booster.earmarkRewards(0);

    let afterTreasuryDFBalance = await df.balanceOf(treasury.address);

    let afterBaseRewardPoolDFBalance = await df.balanceOf(booster.address);

    expect(afterTreasuryDFBalance).to.gt(beforeTreasuryDFBalance);
    expect(afterBaseRewardPoolDFBalance).to.gt(beforeBaseRewardPoolDFBalance);

    // // Only the owner of the baseRewardPool contract can set new operator.
    // await expect(
    //   baseRewardPool.connect(user1).setOperator(newBooster.address)
    // ).to.revertedWith("onlyOwner: caller is not the owner");

    // // Upgrade to the new booster contract in baseRewardPool contract
    // await baseRewardPool.setOperator(newBooster.address);

    // Pause the booster contract
    await booster.shutdownSystem();
    // Upgrade to the new booster contract in dfVoterProxy contract
    await voter.setBooster(newBooster.address);

    // Fail to call earmark to get the reward in the old booster contract.
    await expect(booster.earmarkRewards(0)).to.revertedWith("shutdown");

    // Mine blocks.
    await increaseBlock(500);
    await increaseTime(500);

    beforeTreasuryDFBalance = await df.balanceOf(treasury.address);

    beforeBaseRewardPoolDFBalance = await df.balanceOf(newBooster.address);

    // earmark to get the reward.
    await newBooster.earmarkRewards(0);

    afterTreasuryDFBalance = await df.balanceOf(treasury.address);

    afterBaseRewardPoolDFBalance = await df.balanceOf(newBooster.address);

    expect(afterTreasuryDFBalance).to.gt(beforeTreasuryDFBalance);
    expect(afterBaseRewardPoolDFBalance).to.gt(beforeBaseRewardPoolDFBalance);
  });
});
