import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer, Contract, BigNumber, utils } from "ethers";
import { getChainId } from "./utils/fork";

import { loadFixture, fixtureVoteManager } from "./utils/fixtures";
import { increaseBlock, increaseTime } from "./utils/helper";

const TWO_WEEKS = 60 * 60 * 24 * 7 * 2;

describe("Voter Manager", function () {
  let accounts: Signer[];
  let df: Contract;
  let depositor: Contract;
  let veDFEscrow: Contract;
  let voter: Contract;
  let booster: Contract;
  let boosterL2: Contract;
  let veDF: Contract;
  let addresses: string[];

  let chainId: number;

  async function fixture0Voters() {
    ({ accounts, df, veDFEscrow, voter, depositor, veDF, booster, boosterL2 } =
      await loadFixture(fixtureVoteManager));

    chainId = (await getChainId()) as number;

    addresses = await Promise.all(
      accounts.map((account) => account.getAddress())
    );
  }

  async function fixture2Voters() {
    await loadFixture(fixture0Voters);

    const amount = (await voter.voterMaxBalance()).mul(11).div(10);

    const count = 2;
    let i = 0;
    while (i < count) {
      await df.transfer(depositor.address, amount);
      await depositor.lockDF();

      i++;
    }
  }
  describe("Upgrade", function () {
    it("Should not be able to upgrade again", async function () {
      await loadFixture(fixture0Voters);

      await expect(voter.upgrade(0)).to.revertedWith(
        "_voterMaxBalance must > 0"
      );

      await expect(voter.upgrade(1)).to.revertedWith("Already upgraded");
    });
  });

  describe("Add new voters", function () {
    let voterMaxBalance: BigNumber;

    before(async function () {
      await loadFixture(fixture0Voters);

      voterMaxBalance = await voter.voterMaxBalance();
    });

    it("Should add new voter when increase amount", async function () {
      const amount = (await voter.voterMaxBalance()).mul(11).div(10);

      let voterLength = await voter.votersLength();
      expect(voterLength).to.equal(0);

      const count = 2;
      let i = 0;
      while (i < count) {
        await df.transfer(depositor.address, amount);
        await depositor.lockDF();
        i++;
      }

      voterLength = await voter.votersLength();
      expect(voterLength).to.equal(count);
    });

    it("Should add new voter when increase time", async function () {
      await loadFixture(fixture0Voters);

      const amount = (await voter.voterMaxBalance()).mul(11).div(10);

      const votersBefore = await voter.getVoters();
      const voterLengthBefore = await voter.votersLength();

      const voterToCheck =
        voterLengthBefore > 0 ? votersBefore[0] : voter.address;

      const beforeLocker = await veDFEscrow.getLocker(voterToCheck);
      const [beforeDueTime, beforeDuration, beforeBalance] = beforeLocker;

      const count = 2;
      let i = 0;
      while (i < count) {
        await increaseTime(TWO_WEEKS);
        await increaseBlock(1);

        await df.transfer(depositor.address, amount);
        await depositor.lockDF();

        i++;
      }

      const votersAfter = await voter.getVoters();
      const voterLengthAfter = await voter.votersLength();
      expect(voterLengthAfter).to.equal(voterLengthBefore.add(count));

      const afterLocker = await veDFEscrow.getLocker(votersAfter[0]);
      const [afterDueTime, afterDuration, afterBalance] = afterLocker;

      // Should extend the lock due time
      expect(afterDueTime - beforeDueTime).to.gte(TWO_WEEKS);

      // Check all voters should be the same
      for (const voter of votersAfter) {
        const locker = await veDFEscrow.getLocker(voter);
        const [dueTime, duration, balance] = locker;

        expect(dueTime).to.equal(afterDueTime);
      }
    });

    it("Should not able to change Voter Max Balance to 0", async function () {
      await expect(voter.setVoterMaxBalance(0)).to.revertedWith(
        "_voterMaxBalance must > 0"
      );
    });

    it("Should be able to change Voter Max Balance", async function () {
      await voter.setVoterMaxBalance(voterMaxBalance.mul(5));
    });

    it("Should not add voter if voter's balance < voterMaxBalance", async function () {
      const beforeLength = await voter.votersLength();

      const votersBefore = await voter.getVoters();
      const beforeLocker = await veDFEscrow.getLocker(votersBefore[0]);
      const [beforeDueTime, beforeDuration, beforeBalance] = beforeLocker;

      await df.transfer(depositor.address, voterMaxBalance);
      await depositor.lockDF();

      await increaseTime(TWO_WEEKS);

      await df.transfer(depositor.address, voterMaxBalance);
      await depositor.lockDF();

      await increaseTime(TWO_WEEKS);

      await df.transfer(depositor.address, voterMaxBalance);
      await depositor.lockDF();

      const afterLength = await voter.votersLength();
      const votersAfter = await voter.getVoters();

      const afterLocker = await veDFEscrow.getLocker(votersAfter[0]);
      const [afterDueTime, afterDuration, afterBalance] = afterLocker;

      expect(afterLength).to.eq(beforeLength);
      expect(afterDueTime - beforeDueTime).to.gte(TWO_WEEKS * 2);
    });
  });

  describe("Claim Rewards", function () {
    it("Should be able to claim", async function () {
      // await loadFixture(fixture2Voters);

      const voters = await voter.getVoters();

      await increaseTime(TWO_WEEKS);
      await increaseBlock(1);

      let reward = BigNumber.from(0);
      for (const v of voters) {
        const r = await veDFEscrow.callStatic.earnedInOne(v);
        // console.log(r.toString());

        reward = reward.add(r);
      }

      // console.log(reward.toString());
      const expClaimed = reward.mul(84).div(100);
      // console.log("expected claimed:", expClaimed.toString());

      const boosterL2Before = await df.balanceOf(boosterL2.address);

      await booster.earmarkAndForward(0, 0, "0x");

      const boosterL2After = await df.balanceOf(boosterL2.address);

      const claimed = boosterL2After.sub(boosterL2Before);
      // console.log("claimed:", claimed.toString());

      // allow 0.5% delta, 1 block reward / 2 week reward
      expect(claimed).to.be.closeTo(expClaimed, expClaimed.mul(5).div(1000));
    });
  });

  describe("Delegation", function () {
    it("Should be able to delegate", async function () {
      // await loadFixture(fixture2Voters);

      const votersLength = (await voter.votersLength()).toNumber();
      const voters = await voter.getVoters();

      const indexes = Array.from(Array(votersLength).keys());

      await Promise.all(indexes.map((i) => booster.delegate(i, addresses[i])));

      for (const index of indexes) {
        const delegatee = await veDF.delegates(voters[index]);
        expect(delegatee).to.equal(addresses[index]);

        const votes = await veDF.getCurrentVotes(addresses[index]);
        const balance = await veDF.balanceOf(voters[index]);
        expect(votes).to.be.eq(balance);
      }
    });
  });

  describe("Execute", function () {
    it("Should be able to execute functions on voters", async function () {
      // await loadFixture(fixture2Voters);

      const votersLength = (await voter.votersLength()).toNumber();
      const voters = await voter.getVoters();

      const indexes = Array.from(Array(votersLength).keys());

      const recipient = voter.address;
      const amount = ethers.constants.MaxUint256;
      const approveXData = voter.interface.encodeFunctionData(
        "approveX(address[],address[],uint256[])",
        [[df.address], [recipient], [amount]]
      );

      await Promise.all(
        indexes.map((i) => {
          voter.execute(voters[i], 0, approveXData);
        })
      );

      for (const index of indexes) {
        const allowance = await df.allowance(voters[index], voter.address);
        expect(allowance).to.equal(amount);
      }
    });

    it("Should be able to execute `execute()` on voters", async function () {
      const votersLength = (await voter.votersLength()).toNumber();
      const voters = await voter.getVoters();

      const indexes = Array.from(Array(votersLength).keys());

      // Change the allowance of DF to 0
      const recipient = voter.address;
      const approveData = df.interface.encodeFunctionData(
        "approve(address,uint256)",
        [recipient, 0]
      );

      const executeData = voter.interface.encodeFunctionData(
        "execute(address,uint256,bytes)",
        [df.address, 0, approveData]
      );

      await Promise.all(
        indexes.map((i) => {
          voter.execute(voters[i], 0, executeData);
        })
      );

      for (const index of indexes) {
        const allowance = await df.allowance(voters[index], voter.address);
        expect(allowance).to.equal(0);
      }
    });
  });

  describe.skip("Release", function () {
    it("Should be able to release", async function () {
      await loadFixture(fixture2Voters);

      const votersLength = (await voter.votersLength()).toNumber();
      const voters = await voter.getVoters();

      const indexes = Array.from(Array(votersLength).keys());

      // Wait for the lock to expire
      const FOUR_YEARS = 60 * 60 * 24 * 365 * 4;
      await increaseTime(FOUR_YEARS);

      await depositor.unlockDF({ gasLimit: 10000000 });

      for (const index of indexes) {
        const balance = await veDF.balanceOf(voters[index]);
        expect(balance).to.equal(0);
      }
    });
  });
});
