import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { loadFixture, fixtureDefault } from "../utils/fixturesVelo";
import { AddressZero, MAX } from "../utils/constants";
import { increaseBlock, increaseTime, getTimestamp } from "../utils/helper";

const ONE_WEEK = 60 * 60 * 24 * 7;

describe("Loopfi for Velodrome", function () {
  let accounts: Signer[];
  let doubleVoter: Contract;
  let treasury: Contract;
  let lpDepositor: Contract;
  let lpfLocker: Contract;
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
      treasury,
      lpDepositor,
      lpfLocker,
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

  describe("veDepositor", function () {
    it("Should deposit some velo", async function () {
      const user1 = accounts[1];
      const user1Address = await user1.getAddress();

      const depositAmount = ethers.utils.parseEther("1000");

      const beforeUse1pVeloBalance = await veDepositor.balanceOf(user1Address);
      const beforeveEscrowLockedBallance = (await veVELO.locked(tokenId))
        .amount;

      // Have approved to depositor contract, so deposit directly at here.
      await expect(() =>
        veDepositor.connect(user1).depositTokens(depositAmount)
      ).to.changeTokenBalance(VELO, user1, depositAmount.mul(-1));

      const afterUse1pVeloBalance = await veDepositor.balanceOf(user1Address);
      expect(afterUse1pVeloBalance).to.gt(beforeUse1pVeloBalance);

      const afterveEscrowLockedBallance = (await veVELO.locked(tokenId)).amount;
      expect(
        afterveEscrowLockedBallance.sub(beforeveEscrowLockedBallance)
      ).to.eq(depositAmount);
    });

    it("Should get some rewards", async function () {
      const user1 = accounts[1];
      const user1Address = await user1.getAddress();

      // Update period
      await veloMiner.update_period();

      // Mine some blocks to get rewards.
      await increaseTime(ONE_WEEK);
      await increaseBlock(100);
      // Check point in veVELO
      await veVELO.checkpoint();
      // Update period
      await veloMiner.update_period();

      // Mine some blocks to get rewards.
      await increaseTime(ONE_WEEK);
      await increaseBlock(100);
      // Check point in veVELO
      await veVELO.checkpoint();
      // Update period
      await veloMiner.update_period();

      const beforeVeVELOVeloBalance = await VELO.balanceOf(veVELO.address);
      const claimableBalance = await veDistributor.claimable(tokenId);

      await expect(() =>
        veDepositor.connect(user1).claimFromVeDistributor()
      ).to.changeTokenBalance(veDepositor, treasury, claimableBalance);

      const afterVeVELOVeloBalance = await VELO.balanceOf(veVELO.address);

      expect(afterVeVELOVeloBalance.sub(beforeVeVELOVeloBalance)).to.eq(
        claimableBalance
      );
    });

    it("Should merge two NFTs", async function () {
      const user5 = accounts[5];
      const user5Address = await user5.getAddress();

      const lockAmount = ethers.utils.parseEther("20000");
      const lockDuration = 126142880; // about 4 years

      await VELO.connect(user5).approve(veVELO.address, MAX);

      const newTokenId = await veVELO
        .connect(user5)
        .callStatic.create_lock(lockAmount, lockDuration);
      // Creat a new lock velo NFT.
      await veVELO.connect(user5).create_lock(lockAmount, lockDuration);

      let veNFTOwner = await veVELO.ownerOf(newTokenId);
      expect(veNFTOwner).to.eq(user5Address);

      const beforeOriginalNFTBalance = await veVELO.balanceOfNFT(tokenId);
      const beforeNewNFTBalance = await veVELO.balanceOfNFT(newTokenId);

      // Transfer veVelo NFT to veDepositor contract.
      veVELO
        .connect(user5)
        .safeTransferFrom(user5Address, veDepositor.address, newTokenId);

      const afterOriginalNFTBalance = await veVELO.balanceOfNFT(tokenId);
      const afterNewNFTBalance = await veVELO.balanceOfNFT(newTokenId);

      // When call merge, this will burn NFT
      veNFTOwner = await veVELO.ownerOf(newTokenId);
      expect(veNFTOwner).to.eq(AddressZero);
      expect(afterNewNFTBalance).to.eq(0);

      // When call merge, the balance of the original NFT should increase.
      expect(afterOriginalNFTBalance).to.gt(beforeOriginalNFTBalance);
      expect(afterOriginalNFTBalance).to.gt(beforeNewNFTBalance);

      // After merge, can deposit normarlly.
      const user1 = accounts[1];

      const depositAmount = ethers.utils.parseEther("1000");

      // Have approved to depositor contract, so deposit directly at here.
      await expect(() =>
        veDepositor.connect(user1).depositTokens(depositAmount)
      ).to.changeTokenBalance(VELO, user1, depositAmount.mul(-1));
    });

    it("Withdraw funds from treasury", async function () {
      const user1 = accounts[1];
      const user1Address = await user1.getAddress();

      let treasuryveDepositorBalance = await veDepositor.balanceOf(
        treasury.address
      );

      await expect(() =>
        treasury.withdrawTo(
          veDepositor.address,
          treasuryveDepositorBalance,
          user1Address
        )
      ).to.changeTokenBalance(veDepositor, user1, treasuryveDepositorBalance);

      treasuryveDepositorBalance = await veDepositor.balanceOf(
        treasury.address
      );
      expect(treasuryveDepositorBalance).to.eq(0);
    });
  });
});
