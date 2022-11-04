import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract, BigNumber } from "ethers";

import { TWO_WEEKS, ONE_WEEK } from "../utils/constants";
import { deployContract } from "../utils/fixtures";
import {
  fixtureDefault,
  loadFixture,
  faucetToken,
  getSnapShotDelegationRegistry,
} from "../utils/fixturesSaddle";
import { increaseBlock, increaseTime, log } from "../utils/helper";

describe("Saddle Booster", function () {
  let accounts: Signer[];
  let owner: Signer;
  let user1: Signer;
  let user1Addr: string;

  let SDL: Contract;
  let veSDL: Contract;
  let pSDL: Contract;
  let LPF: Contract;

  let voter: Contract;
  let depositor: Contract;
  let booster: Contract;
  let pSDLStaking: Contract;
  let saddleD4: Contract;
  let saddleD4Staking: Contract;

  let delegationRegistry: Contract;
  let rewardFactory: Contract;

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
      LPF,
      rewardFactory,
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

    saddleD4 = await faucetToken(
      "saddleD4",
      await user1.getAddress(),
      depositAmount
    );

    await saddleD4
      .connect(user1)
      .approve(booster.address, ethers.constants.MaxInt256);

    user1Addr = await user1.getAddress();

    const d4PoolInfo = await booster.poolInfo(0);
    saddleD4Staking = await ethers.getContractAt(
      "SdlBaseRewardPool",
      d4PoolInfo.sdlRewards
    );

    delegationRegistry = await getSnapShotDelegationRegistry();
  });

  it("Should be able to get lp staking pool", async function () {
    const d4PoolInfo = await booster.poolInfo(0);
    log(d4PoolInfo);

    expect(d4PoolInfo.lptoken).to.equal(saddleD4.address);
    expect(d4PoolInfo.shutdown).to.equal(false);
  });

  it("Should be able to deposit and stake lp", async function () {
    await booster.connect(user1).depositAll(0, true);

    const stakedAmount = await saddleD4Staking.balanceOf(user1Addr);

    expect(stakedAmount).to.equal(depositAmount);
  });

  it("Should be able to earmark SDL", async function () {
    const beforeSDLBalance = await SDL.balanceOf(saddleD4Staking.address);
    log("beforeSDLBalance", beforeSDLBalance.toString());

    await increaseTime(TWO_WEEKS * 10);
    await increaseBlock(1);

    const incentive = await booster.callStatic.earmarkRewards(0);
    log("Incentive for earmark pool 0:", incentive.toString());

    // await expect(() =>
    //   booster.connect(user1).earmarkRewards(0)
    // ).to.changeTokenBalance(SDL, user1, incentive);

    await booster.connect(user1).earmarkRewards(0);

    const afterSDLBalance = await SDL.balanceOf(saddleD4Staking.address);
    log("afterSDLBalance", afterSDLBalance.toString());

    expect(afterSDLBalance.sub(beforeSDLBalance)).to.gt(0);
  });

  it("Should be able to get lp staking reward", async function () {
    const beforeSDLBalance = await SDL.balanceOf(user1Addr);
    log("beforeSDLBalance", beforeSDLBalance.toString());

    await increaseTime(ONE_WEEK);
    await increaseBlock(1);

    const earned = await saddleD4Staking.earned(user1Addr);
    log(earned.toString());

    await saddleD4Staking.connect(user1)["getReward()"]();

    const rewardToken = await saddleD4Staking.rewardToken();
    log(rewardToken);

    const afterSDLBalance = await SDL.balanceOf(user1Addr);
    log("afterSDLBalance", afterSDLBalance.toString());

    // We increased 1 week, periodFinished has been reached
    expect(afterSDLBalance.sub(beforeSDLBalance)).to.equal(earned);
  });

  it("Should be able to withdraw lp", async function () {
    const beforeSaddleD4Balance = await saddleD4.balanceOf(user1Addr);
    log("beforeSaddleD4Balance", beforeSaddleD4Balance.toString());

    const balance = await saddleD4Staking.balanceOf(user1Addr);
    log(balance.toString());

    await saddleD4Staking.connect(user1)["withdrawAllAndUnwrap(bool)"](true);

    const rewardToken = await saddleD4Staking.rewardToken();
    log(rewardToken);

    const afterSaddleD4Balance = await saddleD4.balanceOf(user1Addr);
    log("afterSaddleD4Balance", afterSaddleD4Balance.toString());

    expect(afterSaddleD4Balance.sub(beforeSaddleD4Balance)).to.equal(balance);
  });

  describe("Delegation on Snapshot", function () {
    it("Should be able to delegate on snapshot", async function () {
      const ownerAddr = await owner.getAddress();

      const namespace = ethers.utils.formatBytes32String("saddlefinance.eth");
      log("namespace: ", namespace);

      await booster.delegateOnSnapshot(namespace, ownerAddr);

      const delegate = await delegationRegistry.delegation(
        voter.address,
        namespace
      );

      log("delegate: ", delegate);

      expect(delegate).to.equal(ownerAddr);
    });

    it("Should be able to clear delegate on snapshot", async function () {
      const namespace = ethers.utils.formatBytes32String("saddlefinance.eth");
      await booster.clearDelegateOnSnapshot(namespace);

      const delegate = await delegationRegistry.delegation(
        voter.address,
        namespace
      );
      log("delegate: ", delegate);

      expect(delegate).to.equal(ethers.constants.AddressZero);
    });
  });

  describe("Earmark SDL/ETH Fee", function () {
    let feeReward: Contract;
    let feeToken: Contract;

    before(async function () {
      const FEE_TOKEN = "0x0C6F06b32E6Ae0C110861b8607e67dA594781961";
      const FEE_DISTRO = "0xabd040A92d29CDC59837e79651BB2979EA66ce04";

      feeToken = await ethers.getContractAt("ERC20", FEE_TOKEN);

      feeReward = await deployContract("SdlVirtualBalanceRewardPool", [
        pSDLStaking.address,
        FEE_TOKEN,
        booster.address,
      ]);

      await booster.setFeeInfo(FEE_DISTRO, feeReward.address);

      await pSDLStaking.addExtraReward(feeReward.address);
    });

    it("Should be able to earmark fee", async function () {
      // To simulate some fee reward to voter
      const amount = ethers.utils.parseEther("10000");
      await faucetToken("SDLETHSLP", voter.address, amount);

      const before = await feeToken.balanceOf(feeReward.address);
      log("before fee balance", before.toString());

      await booster.connect(user1).earmarkFees();

      const after = await feeToken.balanceOf(feeReward.address);
      log("after fee balance", after.toString());

      expect(after.sub(before)).to.equal(amount);
    });

    it("Should be able to get fee reward", async function () {
      const amount = ethers.utils.parseEther("10000");

      const before = await feeToken.balanceOf(user1Addr);
      log("before fee balance", before.toString());

      await increaseTime(ONE_WEEK + 120);
      await increaseBlock(1);

      const earned = await feeReward.earned(user1Addr);
      log("Earned:", earned.toString());

      await pSDLStaking.connect(user1)["getReward()"]();

      const after = await feeToken.balanceOf(user1Addr);
      log("after fee balance", after.toString());

      expect(after.sub(before)).to.equal(earned);
    });
  });

  it("Should add extra reward token", async function () {
    // Faucet some saddleD4 token to stake.
    saddleD4 = await faucetToken("saddleD4", user1Addr, depositAmount);
    await booster.connect(user1).depositAll(0, true);

    // Get d4 pool contract.
    const d4PoolInfo = await booster.poolInfo(0);
    // Initialize SDL rewards contract
    const sdlRewardPool = await ethers.getContractAt(
      "SdlBaseRewardPool",
      d4PoolInfo.sdlRewards
    );
    // Deploy virtual balance reward contract.
    const extralRewardContract = await deployContract(
      "VirtualBalanceRewardPool",
      [d4PoolInfo.sdlRewards, LPF.address]
    );

    // Before adding extra reward, SDL reward contract has no extra rewards.
    expect(await sdlRewardPool.extraRewardsLength()).to.eq(0);
    // Add extra reward to d4 stash.
    await rewardFactory.addExtraReward(0, extralRewardContract.address);
    expect(await sdlRewardPool.extraRewardsLength()).to.eq(1);

    // Faucet some LPF token to distribute.
    const faucetAmount = ethers.utils.parseEther("10000"); // 10k
    await faucetToken("LPF", extralRewardContract.address, faucetAmount);
    // Before distributing rewards, reward rate should be 0.
    expect(await extralRewardContract.rewardRate()).to.eq(0);
    // Queue to distribute rewards
    await extralRewardContract.queueNewRewards(faucetAmount);
    expect(await extralRewardContract.rewardRate()).to.gt(0);

    log("balance: ", (await sdlRewardPool.balanceOf(user1Addr)).toString());

    // Mine some blocks to get rewards.
    await increaseTime(3600 * 24 * 365 + 100);
    await increaseBlock(10);

    const earnedExtraReward = await extralRewardContract.earned(user1Addr);
    expect(earnedExtraReward).to.gt(0);

    // Initialize stash contract
    await expect(() =>
      sdlRewardPool.connect(user1)["getReward()"]()
    ).to.changeTokenBalance(LPF, user1, earnedExtraReward);
  });
});
