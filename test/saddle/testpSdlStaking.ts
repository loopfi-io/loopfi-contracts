import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract, BigNumber } from "ethers";

import { AddressZero, TWO_WEEKS, ONE_WEEK } from "../utils/constants";
import { increaseBlock, increaseTime, log } from "../utils/helper";
import {
  fixtureDefault,
  loadFixture,
  faucetToken,
} from "../utils/fixturesSaddle";

describe("pSaddle Staking", function () {
  let accounts: Signer[];
  let owner: Signer;
  let user1: Signer;
  let user1Addr: string;

  let SDL: Contract;
  let veSDL: Contract;
  let pSDL: Contract;

  let voter: Contract;
  let depositor: Contract;
  let booster: Contract;
  let pSDLStaking: Contract;

  let depositAmount: BigNumber;

  before(async function () {
    ({
      owner,
      accounts,
      SDL,
      veSDL,
      pSDL,
      voter,
      depositor,
      booster,
      pSDLStaking,
    } = await loadFixture(fixtureDefault));

    user1 = accounts[0];
    depositAmount = ethers.utils.parseEther("1000");

    await depositor
      .connect(user1)
      ["deposit(uint256,bool,address)"](
        depositAmount,
        true,
        pSDLStaking.address
      );

    user1Addr = await user1.getAddress();

    const saddleD4 = await faucetToken("saddleD4", user1Addr, depositAmount);

    await saddleD4
      .connect(user1)
      .approve(booster.address, ethers.constants.MaxInt256);

    await booster.connect(user1).depositAll(0, true);
  });

  it("Should be able to get reward", async function () {
    await increaseTime(TWO_WEEKS);
    await booster.earmarkRewards(0);

    const beforeSDLBalance = await SDL.balanceOf(user1Addr);
    log("beforeSDLBalance", beforeSDLBalance.toString());

    await increaseTime(ONE_WEEK);
    await pSDLStaking.connect(user1)["getReward()"]();

    const afterSDLBalance = await SDL.balanceOf(user1Addr);
    log("afterSDLBalance", afterSDLBalance.toString());

    expect(afterSDLBalance.sub(beforeSDLBalance)).to.gt(0);
  });

  // pSDLStaking is also an instance of `SdlBaseRewardPool`, but should fail on LP related functions
  it("Should failed when withdraw", async function () {
    await expect(
      pSDLStaking.connect(user1).withdrawAllAndUnwrap(false)
    ).to.be.revertedWith("!auth");
  });
});
