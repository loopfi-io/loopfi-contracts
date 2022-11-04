import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { loadFixture, fixtureDefault } from "../utils/fixturesVelo";
import { AddressZero, MAX } from "../utils/constants";
import { increaseBlock, increaseTime, getTimestamp } from "../utils/helper";

const ONE_WEEK = 60 * 60 * 24 * 7;
const SIXTHEEN_WEEKs = 60 * 60 * 24 * 7 * 16;
const HALF_DAY = 60 * 60 * 12;

describe.skip("Loopfi for Velodrome", function () {
  let accounts: Signer[];
  let doubleVoter: Contract;
  let feeDistributor: Contract;
  let lpDepositor: Contract;
  let LPF: Contract;
  let lpfLocker: Contract;
  let OP: Contract;
  let owner: Signer;
  let tokenId: any;
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
      // feeDistributor,
      lpDepositor,
      LPF,
      lpfLocker,
      OP,
      owner,
      tokenId,
      USXDFLP,
      VELO,
      veloMiner,
      VELOOPLP,
      veDepositor,
      veDistributor,
      veVELO,
    } = await loadFixture(fixtureDefault));
  });

  describe("Locker", function () {
    it("Lock LPF", async function () {
      const user1LockAmount = ethers.utils.parseEther("500");
      const user1 = accounts[1];
      const user1Address = await user1.getAddress();
      const user2LockAmount = ethers.utils.parseEther("100");
      const user2 = accounts[2];
      const user2Address = await user2.getAddress();
      const user10 = accounts[10];

      await expect(() =>
        lpfLocker.connect(user1).lock(user1Address, user1LockAmount)
      ).to.changeTokenBalance(LPF, user1, user1LockAmount.mul(-1));

      const user1Balance = await lpfLocker.userBalance(user1Address);
      expect(user1Balance).to.eq(user1LockAmount);

      // Mine blocks.
      await increaseTime(HALF_DAY);
      await increaseBlock(10);

      await expect(() =>
        lpfLocker.connect(user2).lock(user2Address, user2LockAmount)
      ).to.changeTokenBalance(LPF, user2, user2LockAmount.mul(-1));

      const user2Balance = await lpfLocker.userBalance(user2Address);
      expect(user2Balance).to.eq(user2LockAmount);

      // const totalWeight = await lpfLocker.totalWeight();
      // expect(user1Balance.add(user2Balance)).to.eq(totalWeight);
      // Distribute OP fee.
      const opFeeAmount = ethers.utils.parseEther("10000");
      await OP.connect(user10).approve(feeDistributor.address, MAX);
      await feeDistributor.connect(user10).depositFee(OP.address, opFeeAmount);
      // Distribute LPF fee.
      const lpfFeeAmount = ethers.utils.parseEther("30000");
      await LPF.connect(user10).approve(feeDistributor.address, MAX);
      await feeDistributor
        .connect(user10)
        .depositFee(LPF.address, lpfFeeAmount);

      // Mine blocks.
      await increaseTime(ONE_WEEK);
      await increaseBlock(10);

      const getUser1ActiveLocks = await lpfLocker.getActiveUserLocks(
        user1Address
      );
      console.log("getUser1ActiveLocks", getUser1ActiveLocks.toString());
      const getUser2ActiveLocks = await lpfLocker.getActiveUserLocks(
        user2Address
      );
      console.log("getUser2ActiveLocks", getUser2ActiveLocks.toString());

      const user1Rewards = await feeDistributor.claimable(user1Address, [
        OP.address,
        LPF.address,
      ]);
      console.log("user1Rewards", user1Rewards.toString());
      const user2Rewards = await feeDistributor.claimable(user2Address, [
        OP.address,
        LPF.address,
      ]);
      console.log("user2Rewards", user2Rewards.toString());
    });

    it("Get rewards", async function () {
      const user1 = accounts[1];
      const user1Address = await user1.getAddress();
      const user2 = accounts[2];
      const user2Address = await user2.getAddress();
      // Mine blocks
      await increaseTime(SIXTHEEN_WEEKs);
      await increaseBlock(10);

      const getUser1ActiveLocks = await lpfLocker.getActiveUserLocks(
        user1Address
      );
      console.log("getUser1ActiveLocks", getUser1ActiveLocks.toString());
      const getUser2ActiveLocks = await lpfLocker.getActiveUserLocks(
        user2Address
      );
      console.log("getUser2ActiveLocks", getUser2ActiveLocks.toString());

      const user2LockAmount = ethers.utils.parseEther("100");
      await expect(() =>
        lpfLocker.connect(user2).lock(user2Address, user2LockAmount)
      ).to.changeTokenBalance(LPF, user2, user2LockAmount.mul(-1));

      const user1Rewards = await feeDistributor.claimable(user1Address, [
        OP.address,
        LPF.address,
      ]);
      console.log("user1Rewards", user1Rewards.toString());
      const user2Rewards = await feeDistributor.claimable(user2Address, [
        OP.address,
        LPF.address,
      ]);
      console.log("user2Rewards", user2Rewards.toString());
      // const rewards = await feeDistributor.claimable(user5Address, [
      //   OP.address,
      //   LPF.address,
      // ]);
      // console.log("rewards", rewards.toString());
    });

    it("Lock LPF", async function () {
      const user1LockAmount = ethers.utils.parseEther("500");
      const user1 = accounts[1];
      const user1Address = await user1.getAddress();
      const user2LockAmount = ethers.utils.parseEther("100");
      const user2 = accounts[2];
      const user2Address = await user2.getAddress();
      const user10 = accounts[10];

      // Distribute OP fee.
      const opFeeAmount = ethers.utils.parseEther("10000");
      await OP.connect(user10).approve(feeDistributor.address, MAX);
      await feeDistributor.connect(user10).depositFee(OP.address, opFeeAmount);
      // Distribute LPF fee.
      const lpfFeeAmount = ethers.utils.parseEther("30000");
      await LPF.connect(user10).approve(feeDistributor.address, MAX);
      await feeDistributor
        .connect(user10)
        .depositFee(LPF.address, lpfFeeAmount);

      // Mine blocks.
      await increaseTime(ONE_WEEK);
      await increaseBlock(10);

      const getUser1ActiveLocks = await lpfLocker.getActiveUserLocks(
        user1Address
      );
      console.log("getUser1ActiveLocks", getUser1ActiveLocks.toString());
      const getUser2ActiveLocks = await lpfLocker.getActiveUserLocks(
        user2Address
      );
      console.log("getUser2ActiveLocks", getUser2ActiveLocks.toString());

      const user1Rewards = await feeDistributor.claimable(user1Address, [
        OP.address,
        LPF.address,
      ]);
      console.log("user1Rewards", user1Rewards.toString());
      const user2Rewards = await feeDistributor.claimable(user2Address, [
        OP.address,
        LPF.address,
      ]);
      console.log("user2Rewards", user2Rewards.toString());
    });
  });
});
