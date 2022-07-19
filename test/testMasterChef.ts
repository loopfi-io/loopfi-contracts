import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, Contract } from "ethers";

import { loadFixture, fixtureL2, deployContract } from "./utils/fixtures";
import { AddressZero, MAX } from "./utils/constants";
import { increaseBlock, increaseTime } from "./utils/helper";

describe.skip("MasterChef", function () {
  let accounts: Signer[];
  let lpfL2: Contract;
  let df: Contract;
  let lpfDFPairL2: Contract;
  let lpfUSXPairL2: Contract;
  let pDFDFPairL2: Contract;
  let chef: Contract;
  let lpfDAIPair: Contract;

  async function init() {
    ({ accounts, df, chef, lpfDFPairL2, lpfL2, lpfUSXPairL2, pDFDFPairL2 } =
      await loadFixture(fixtureL2));
  }

  it("Init", async function () {
    await init();
  });

  it("Should add uniswap pair to chef", async function () {
    const user1 = accounts[0];
    const uer1Address = await user1.getAddress();
    const user2 = accounts[1];
    const uer2Address = await user2.getAddress();
    const user3 = accounts[2];
    const uer3Address = await user3.getAddress();
    const depositAmount = ethers.utils.parseEther("1000"); // 1000
    const lpfDFPairL2Incentive = 50000; // 19000
    const lpfUSXPairL2Incentive = 30000; // 1000
    const pDFDFXPairPairIncentive = 20000;

    await chef.add(
      lpfDFPairL2Incentive,
      lpfDFPairL2.address,
      AddressZero,
      false
    );

    await chef.add(
      lpfUSXPairL2Incentive,
      lpfUSXPairL2.address,
      AddressZero,
      true
    );

    await chef.add(
      pDFDFXPairPairIncentive,
      pDFDFPairL2.address,
      AddressZero,
      true
    );

    await expect(() =>
      chef.connect(user1).deposit(0, depositAmount)
    ).to.changeTokenBalance(lpfDFPairL2, user1, depositAmount.mul(-1));

    await expect(() =>
      chef.connect(user2).deposit(1, depositAmount)
    ).to.changeTokenBalance(lpfUSXPairL2, user2, depositAmount.mul(-1));

    await expect(() =>
      chef.connect(user3).deposit(2, depositAmount)
    ).to.changeTokenBalance(pDFDFPairL2, user3, depositAmount.mul(-1));

    const beforeUser1PendingLPF = await chef.pendingLPF(0, uer1Address);
    const beforeUser2PendingLPF = await chef.pendingLPF(1, uer2Address);
    const beforeUser3PendingLPF = await chef.pendingLPF(2, uer3Address);

    // Mine blocks.
    await increaseBlock(500);
    await increaseTime(500);

    const afterUser1PendingLPF = await chef.pendingLPF(0, uer1Address);
    expect(afterUser1PendingLPF).to.gt(beforeUser1PendingLPF);

    const afterUser2PendingLPF = await chef.pendingLPF(1, uer2Address);
    expect(afterUser2PendingLPF).to.gt(beforeUser2PendingLPF);

    const afterUser3PendingLPF = await chef.pendingLPF(2, uer3Address);
    expect(afterUser3PendingLPF).to.gt(beforeUser3PendingLPF);

    // Claim rewards
    const beforeUser1LPFBalance = await lpfL2.balanceOf(uer1Address);
    await chef.claim(0, uer1Address);
    const afterUser1LPFBalance = await lpfL2.balanceOf(uer1Address);
    const user1LPFBalanceChanged = afterUser1LPFBalance.sub(
      beforeUser1LPFBalance
    );

    expect(afterUser1LPFBalance).to.gt(beforeUser1LPFBalance);

    const beforeUser2LPFBalance = await lpfL2.balanceOf(uer2Address);
    await chef.claim(1, uer2Address);
    const afterUser2LPFBalance = await lpfL2.balanceOf(uer2Address);
    const user2LPFBalanceChanged = afterUser2LPFBalance.sub(
      beforeUser2LPFBalance
    );
    expect(afterUser2LPFBalance).to.gt(beforeUser2LPFBalance);

    const beforeUser3LPFBalance = await lpfL2.balanceOf(uer3Address);
    await chef.claim(2, uer3Address);
    const afterUser3LPFBalance = await lpfL2.balanceOf(uer3Address);
    const user3LPFBalanceChanged = afterUser3LPFBalance.sub(
      beforeUser3LPFBalance
    );
    expect(afterUser3LPFBalance).to.gt(beforeUser3LPFBalance);

    expect(user1LPFBalanceChanged.mul(lpfUSXPairL2Incentive)).to.eq(
      user2LPFBalanceChanged.mul(lpfDFPairL2Incentive)
    );

    expect(user1LPFBalanceChanged.mul(pDFDFXPairPairIncentive)).to.eq(
      user3LPFBalanceChanged.mul(lpfDFPairL2Incentive)
    );
  });
});
