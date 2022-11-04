import { expect } from "chai";
import { ethers, network } from "hardhat";
import { Signer, Contract } from "ethers";

import { loadFixture, fixtureL2, claimAndLock } from "./utils/fixtures";
import { MAX, AddressZero } from "./utils/constants";
import { getChainId } from "./utils/fork";
import { increaseBlock, increaseTime } from "./utils/helper";

const TWO_WEEKS = 60 * 60 * 24 * 7 * 2;

describe("Depositor", function () {
  let accounts: Signer[];
  let df: Contract;
  let depositor: Contract;
  let depositorL2: Contract;
  let veDFEscrow: Contract;
  let voter: Contract;
  let stakingPoolL2: Contract;
  let booster: Contract;
  let veDF: Contract;
  let chainId: number;
  let arbBridge: Contract;
  let treasury: Contract;
  let boosterL2: Contract;

  before(async function () {
    ({
      accounts,
      df,
      veDFEscrow,
      voter,
      depositor,
      depositorL2,
      booster,
      veDF,
      stakingPoolL2,
      arbBridge,
      treasury,
      boosterL2,
    } = await loadFixture(fixtureL2));

    chainId = (await getChainId()) as number;
  });

  it("Should deposit df and lock", async function () {
    const user1 = accounts[0];
    const account1 = await user1.getAddress();
    const depositAmount = ethers.utils.parseEther("1000"); // 1000

    // Approve depositor contract.
    await df.connect(user1).approve(depositorL2.address, MAX);

    const unstakeDFAmount = await df.balanceOf(depositorL2.address);

    // Deposit df and lock
    const beforeveDFBalance = await veDFEscrow.balanceOf(voter.address);
    // console.log("beforeveDFBalance", beforeveDFBalance.toString());

    await depositorL2
      .connect(user1)
      ["deposit(uint256,bool,address)"](depositAmount, true, AddressZero);

    const beforeDFBalance = await df.balanceOf(account1);
    // console.log("beforeDFBalance", beforeDFBalance.toString());

    await claimAndLock(depositor, arbBridge, df, user1);

    const afterDFBalance = await df.balanceOf(account1);
    // console.log("afterDFBalance", afterDFBalance.toString());

    const afterveDFBalance = await veDFEscrow.balanceOf(voter.address);
    // console.log("afterveDFBalance", afterveDFBalance.toString());

    expect(afterveDFBalance).to.gt(beforeveDFBalance);
    expect(afterDFBalance.sub(beforeDFBalance)).to.equal(
      depositAmount
        .mul(await depositor.lockIncentive())
        .div(await depositor.FEE_DENOMINATOR())
    );

    // await expect(() =>
    //   depositor
    //     .connect(user1)
    //     ["deposit(uint256,bool,address)"](depositAmount, true, AddressZero)
    // ).to.changeTokenBalance(
    //   veDFEscrow,
    //   voter,
    //   depositAmount.add(unstakeDFAmount)
    // );
  });

  it("Should deposit df, lock and stake", async function () {
    const user1 = accounts[0];
    const depositAmount = ethers.utils.parseEther("1000"); // 1000

    // Approve depositor contract.
    // await df.connect(user1).approve(depositor.address, MAX);

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
  });

  it("Should be able to only increase the amount of locker of veDF", async function () {
    if (chainId === 31337) {
      console.log("Skip this test on hardhat");
      return;
    }

    const user1 = accounts[0];
    const depositAmount = ethers.utils.parseEther("1000"); // 1000

    const beforeLocker = await veDFEscrow.getLocker(voter.address);
    const [beforeDueTime, beforeDuration, beforeBalance] = beforeLocker;

    // console.log(beforeLocker.toString());

    // Mine blocks, allow 5 mins for test execution
    await increaseTime(TWO_WEEKS - 10 * 60);
    await increaseBlock(1);

    await depositorL2
      .connect(user1)
      ["deposit(uint256,bool,address)"](
        depositAmount,
        true,
        stakingPoolL2.address
      );

    await claimAndLock(depositor, arbBridge, df, user1);

    const afterLocker = await veDFEscrow.getLocker(voter.address);
    const [afterDueTime, afterDuration, afterBalance] = afterLocker;

    // console.log(afterLocker.toString());

    // Should not update due time and increase the balance.
    expect(afterDueTime).to.eq(beforeDueTime);
    expect(afterDuration).to.eq(beforeDuration);
    expect(afterBalance).to.gt(beforeBalance);
  });

  it("Should be able to extend the duration the locker of veDF", async function () {
    if (chainId === 31337) {
      console.log("Skip this test on hardhat");
      return;
    }

    const user1 = accounts[0];
    const depositAmount = ethers.utils.parseEther("1000"); // 1000

    const beforeLocker = await veDFEscrow.getLocker(voter.address);
    const [beforeDueTime, beforeDuration, beforeBalance] = beforeLocker;

    // console.log(beforeLocker.toString());

    // Mine blocks
    await increaseTime(TWO_WEEKS);
    await increaseBlock(1);

    await depositorL2
      .connect(user1)
      ["deposit(uint256,bool,address)"](
        depositAmount,
        true,
        stakingPoolL2.address
      );

    await claimAndLock(depositor, arbBridge, df, user1);

    const afterLocker = await veDFEscrow.getLocker(voter.address);
    const [afterDueTime, afterDuration, afterBalance] = afterLocker;

    // console.log(afterLocker.toString());

    // Should at least extend the due time for 2 weeks.
    expect(afterDueTime - beforeDueTime).to.gte(TWO_WEEKS);
    expect(afterBalance).to.gt(beforeBalance);
  });

  it("Should delegate to new users", async function () {
    if (chainId === 31337) {
      console.log("Skip this test on hardhat");
      return;
    }

    const user1 = accounts[0];
    const user1Address = await user1.getAddress();

    const beforeUser1VotingPower = await veDF.getCurrentVotes(user1Address);

    await booster.delegate(0, user1Address);
    const afterVoterDelegatee = await veDF.delegates(voter.address);
    expect(afterVoterDelegatee).to.eq(user1Address);

    const afterUser1VotingPower = await veDF.getCurrentVotes(user1Address);
    expect(afterUser1VotingPower).gt(beforeUser1VotingPower);
  });

  it("Should revert when caller does not have permission", async function () {
    const user1 = accounts[0];
    const user1Address = await user1.getAddress();

    await expect(
      booster.connect(user1).delegate(0, user1Address)
    ).to.revertedWith("onlyOwner: caller is not the owner");
  });

  it("Should earmark", async function () {
    const user1 = accounts[0];
    const user1Address = await user1.getAddress();

    let count = 3;
    while (count--) {
      const beforeEarmarkUser1DfBalance = await df.balanceOf(user1Address);
      const beforeEarmarkTreasuryDfBalance = await df.balanceOf(
        treasury.address
      );
      const beforeEarmarkBoosterL2DfBalance = await df.balanceOf(
        boosterL2.address
      );

      const reward = await veDFEscrow.callStatic.earnedInOne(voter.address);
      // console.log("reward", reward.toString());

      await booster.connect(user1).earmarkRewards(0);

      const afterEarmarkUser1DfBalance = await df.balanceOf(user1Address);
      const afterEarmarkTreasuryDfBalance = await df.balanceOf(
        treasury.address
      );
      const afterEarmarkBoosterL2DfBalance = await df.balanceOf(
        boosterL2.address
      );

      const platformFee = await booster.platformFee();

      const forwardIncentive = await booster.forwardIncentive();
      const FEE_DENOMINATOR = await booster.FEE_DENOMINATOR();

      const diffTreasury = afterEarmarkTreasuryDfBalance.sub(
        beforeEarmarkTreasuryDfBalance
      );
      const diffEarmarker = afterEarmarkUser1DfBalance.sub(
        beforeEarmarkUser1DfBalance
      );
      const diffBoosterL2 = afterEarmarkBoosterL2DfBalance.sub(
        beforeEarmarkBoosterL2DfBalance
      );

      // console.log("treasury", diffTreasury.toString());
      // console.log("earmarker", diffEarmarker.toString());
      // console.log("boosterL2", diffBoosterL2.toString());

      const expectTreasury = reward.mul(platformFee).div(FEE_DENOMINATOR);
      const allowedDelta = chainId === 31337 ? 0 : 10;
      expect(diffTreasury).to.closeTo(
        expectTreasury,
        expectTreasury.mul(allowedDelta).div(10000)
      );
      expect(diffEarmarker).to.equal(0);
      expect(diffBoosterL2).to.equal(0);

      await increaseTime(TWO_WEEKS);
      await increaseBlock(1);
    }
  });

  it("Should forward reward", async function () {
    const user1 = accounts[0];
    const user1Address = await user1.getAddress();

    const beforeEarmarkUser1DfBalance = await df.balanceOf(user1Address);
    const beforeEarmarkTreasuryDfBalance = await df.balanceOf(treasury.address);
    const beforeEarmarkBoosterL2DfBalance = await df.balanceOf(
      boosterL2.address
    );

    const reward = await df.balanceOf(booster.address);
    // console.log("reward", reward.toString());

    await booster.connect(user1).forwardRewards(1, 1, "0x", { value: 100 });

    const afterEarmarkUser1DfBalance = await df.balanceOf(user1Address);
    const afterEarmarkTreasuryDfBalance = await df.balanceOf(treasury.address);
    const afterEarmarkBoosterL2DfBalance = await df.balanceOf(
      boosterL2.address
    );

    const platformFee = await booster.platformFee();

    const forwardIncentive = await booster.forwardIncentive();
    const FEE_DENOMINATOR = await booster.FEE_DENOMINATOR();

    const diffTreasury = afterEarmarkTreasuryDfBalance.sub(
      beforeEarmarkTreasuryDfBalance
    );
    const diffEarmarker = afterEarmarkUser1DfBalance.sub(
      beforeEarmarkUser1DfBalance
    );
    const diffBoosterL2 = afterEarmarkBoosterL2DfBalance.sub(
      beforeEarmarkBoosterL2DfBalance
    );

    // console.log("treasury", diffTreasury.toString());
    // console.log("earmarker", diffEarmarker.toString());
    // console.log("boosterL2", diffBoosterL2.toString());

    expect(diffTreasury).to.equal(0);
    expect(diffEarmarker).to.equal(
      reward.mul(forwardIncentive).div(FEE_DENOMINATOR)
    );
    expect(diffBoosterL2).to.equal(
      reward.sub(reward.mul(forwardIncentive).div(FEE_DENOMINATOR))
    );

    await increaseTime(TWO_WEEKS);
    await increaseBlock(1);
  });

  it("Should earmark and make cross-transfer at the same time, and get incentive", async function () {
    const user1 = accounts[0];
    const user1Address = await user1.getAddress();

    const beforeEarmarkUser1DfBalance = await df.balanceOf(user1Address);
    const beforeEarmarkTreasuryDfBalance = await df.balanceOf(treasury.address);
    const beforeEarmarkBoosterL2DfBalance = await df.balanceOf(
      boosterL2.address
    );

    const reward = await veDFEscrow.callStatic.earnedInOne(voter.address);
    // console.log("reward", reward.toString());

    await booster.connect(user1).earmarkAndForward(1, 1, "0x", { value: 100 });

    const afterEarmarkUser1DfBalance = await df.balanceOf(user1Address);
    const afterEarmarkTreasuryDfBalance = await df.balanceOf(treasury.address);
    const afterEarmarkBoosterL2DfBalance = await df.balanceOf(
      boosterL2.address
    );

    // In BoosterNew contract, only flatform fee, so df rewards will be two parts:
    // 1: to treasury: 15%
    // 2: left to boosterNew contract: 85%
    // And when trahsfer rewards in boosterNew contract cross-chain,
    // caller will get some incentive: 1%,
    // and in test, the remaining rewards will be transfered to boosterL2 contract.
    const platformFee = await booster.platformFee();

    const forwardIncentive = await booster.forwardIncentive();
    const FEE_DENOMINATOR = await booster.FEE_DENOMINATOR();

    const diffTreasury = afterEarmarkTreasuryDfBalance.sub(
      beforeEarmarkTreasuryDfBalance
    );
    const diffEarmarker = afterEarmarkUser1DfBalance.sub(
      beforeEarmarkUser1DfBalance
    );
    const diffBoosterL2 = afterEarmarkBoosterL2DfBalance.sub(
      beforeEarmarkBoosterL2DfBalance
    );

    // console.log("treasury", diffTreasury.toString());
    // console.log("earmarker", diffEarmarker.toString());
    // console.log("boosterL2", diffBoosterL2.toString());

    const expectTreasury = reward.mul(platformFee).div(FEE_DENOMINATOR);
    const expectEarmark = reward
      .sub(expectTreasury)
      .mul(forwardIncentive)
      .div(FEE_DENOMINATOR);
    const expectBoosterL2 = reward.sub(expectTreasury).sub(expectEarmark);

    // console.log("expectTreasury", expectTreasury.toString());
    // console.log("expectEarmark", expectEarmark.toString());
    // console.log("expectBoosterL2", expectBoosterL2.toString());

    expect(diffTreasury).to.equal(expectTreasury);
    expect(diffEarmarker).to.equal(expectEarmark);
    expect(diffBoosterL2).to.equal(expectBoosterL2);

    // expect(
    //   afterEarmarkTreasuryDfBalance
    //     .sub(beforeEarmarkTreasuryDfBalance)
    //     .div(afterEarmarkUser1DfBalance.sub(beforeEarmarkUser1DfBalance))
    // ).to.eq(
    //   platformFee.div(
    //     FEE_DENOMINATOR.sub(platformFee)
    //       .mul(forwardIncentive)
    //       .div(FEE_DENOMINATOR)
    //   )
    // );
    // expect(
    //   afterEarmarkBoosterL2DfBalance
    //     .sub(beforeEarmarkBoosterL2DfBalance)
    //     .add(afterEarmarkUser1DfBalance.sub(beforeEarmarkUser1DfBalance))
    //     .div(afterEarmarkTreasuryDfBalance.sub(beforeEarmarkTreasuryDfBalance))
    // ).to.eq(FEE_DENOMINATOR.sub(platformFee).div(platformFee));
  });

  it("Should withdraw all DF when unlock DF", async function () {
    const iface = new ethers.utils.Interface([
      "function transferFrom(address from, address to, uint amount)",
    ]);
    await network.provider.send("evm_setAutomine", [false]);

    const beforeveDFBalance = await veDFEscrow.balanceOf(voter.address);
    // console.log(beforeveDFBalance.toString());

    const beforeTreasuryDFBalance = await df.balanceOf(treasury.address);
    expect(beforeveDFBalance).to.gt(0);

    // Wait for the lock to expire
    const FOUR_YEARS = 60 * 60 * 24 * 365 * 4;
    await increaseTime(FOUR_YEARS);
    await increaseBlock(1);

    // const reward = await veDFEscrow.callStatic.earnedInOne(voter.address);
    // console.log(reward.toString());

    // Unlock DF in veDF manager.
    await depositor.unlockDF({ gasLimit: 10000000 });
    // // Voter proxy make appraval to treasury contract.
    await voter.approveX([df.address], [treasury.address], [MAX]);
    // Withdraw DF from treasury.
    // encode data for `transferFrom`
    const data = iface.encodeFunctionData("transferFrom", [
      voter.address,
      treasury.address,
      beforeveDFBalance,
    ]);

    await treasury.execute(df.address, 0, data);

    const beforeAllowance = await df.allowance(voter.address, treasury.address);
    expect(beforeAllowance).to.eq(0);

    await increaseBlock(10);
    const afterAllowance = await df.allowance(voter.address, treasury.address);
    expect(afterAllowance).to.gt(0);

    const afterveDFBalance = await veDFEscrow.balanceOf(voter.address);
    const afterTreasuryDFBalance = await df.balanceOf(treasury.address);

    expect(afterveDFBalance).to.eq(0);
    expect(afterTreasuryDFBalance.sub(beforeTreasuryDFBalance)).to.eq(
      beforeveDFBalance
    );

    await network.provider.send("evm_setAutomine", [true]);
  });
});
