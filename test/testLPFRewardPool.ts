import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, Contract } from "ethers";

import { loadFixture, fixtureL2 } from "./utils/fixtures";
import { AddressZero, MAX } from "./utils/constants";
import { increaseBlock, increaseTime } from "./utils/helper";

describe.skip("LPF Reward Pool on L2", function () {
  let accounts: Signer[];
  let owner: Signer;
  let df: Contract;
  let pDFL2: Contract;
  let lpfL2: Contract;
  let depositorL2: Contract;
  let boosterL2: Contract;
  let lpfRewardPoolL2: Contract;
  let veDFEscrow: Contract;

  async function init() {
    ({
      accounts,
      boosterL2,
      lpfRewardPoolL2,
      pDFL2,
      df,
      depositorL2,
      lpfL2,
      veDFEscrow,
      owner,
    } = await loadFixture(fixtureL2));
  }

  it("Init", async function () {
    await init();
  });

  it("Should get rewards, after staking", async function () {
    const user1 = accounts[0];
    const user1Address = await user1.getAddress();
    const ownerAddress = await owner.getAddress();
    const depositAmount = ethers.utils.parseEther("1000"); // 1000

    // Mint some free df token to mock getting df rewards form L1
    await df.transfer(boosterL2.address, depositAmount);

    const beforeDFBalanceInLPFRewardPool = await df.balanceOf(
      lpfRewardPoolL2.address
    );

    // Set reward rate for LPF reward pool
    await boosterL2.earmarkRewards(0);
    const afterDFBalanceInLPFRewardPool = await df.balanceOf(
      lpfRewardPoolL2.address
    );

    expect(afterDFBalanceInLPFRewardPool).to.gt(beforeDFBalanceInLPFRewardPool);

    await lpfL2.mint(ownerAddress, depositAmount);

    // Approve LPF reward pool contract.
    await lpfL2.approve(lpfRewardPoolL2.address, MAX);

    await expect(() =>
      lpfRewardPoolL2.stake(depositAmount)
    ).to.changeTokenBalance(lpfL2, owner, depositAmount.mul(-1));

    // Mine blocks.
    await increaseBlock(500);
    await increaseTime(500);

    // Get rewards
    const beforeOwnerpDFBalance = await pDFL2.balanceOf(ownerAddress);
    await lpfRewardPoolL2["getReward(bool)"](false);
    const afterOwnerpDFBalance = await pDFL2.balanceOf(ownerAddress);
    expect(afterOwnerpDFBalance).to.gt(beforeOwnerpDFBalance);
  });
});
