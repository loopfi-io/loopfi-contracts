import { ethers, waffle, network } from "hardhat";
import { getBlock, getTimestamp } from "./helper";
import { MAX, AddressZero } from "./constants";
import { BigNumber, Contract, Signer } from "ethers";

import {
  getChainId,
  allocateDF,
  getDFInstance,
  getVEDFInstance,
  getVEDFManagerInstance,
} from "./fork";

// Use ethers provider instead of waffle's default MockProvider
export const loadFixture = waffle.createFixtureLoader([], waffle.provider);

async function getCurrentTimestamp() {
  const blockNumber = await waffle.provider.getBlockNumber();
  const block = await waffle.provider.getBlock(blockNumber);

  return block.timestamp;
}

export async function deployContract(contractName: string, args: any[]) {
  const contract = await ethers.getContractFactory(contractName);
  const deployed = await contract.deploy(...args);
  await deployed.deployed();
  return deployed;
}

export async function faucetDF(df: Contract, to: string, amount: BigNumber) {
  const chainId = await getChainId();

  if (chainId == 31337) {
    await df.mint(to, amount);
  } else {
    await allocateDF(df, to, amount);
  }
}

async function distributeAndApprove(
  accounts: Signer[],
  df: Contract,
  depositor: Contract,
  tokens: Contract[],
  spenders: Contract[]
) {
  const faucetAmount = ethers.utils.parseEther("1000000"); // 1000,000
  await Promise.all(
    accounts.map(async (account) => {
      const address = await account.getAddress();

      await faucetDF(df, address, faucetAmount);
      await df.connect(account).approve(depositor.address, 0);
      await df.connect(account).approve(depositor.address, MAX);

      await Promise.all(
        tokens.map(async (token) => {
          await token.mint(address, faucetAmount);
          await token
            .connect(account)
            .approve(spenders[tokens.indexOf(token)].address, MAX);
        })
      );
    })
  );
}

async function deployLiquidityMining(
  rewardToken: Contract,
  lpTokens: Contract[],
  rewardRates: BigNumber[]
) {
  const rewardDistributor = await deployContract("RewardDistributor", [
    rewardToken.address,
  ]);

  for (const lpToken of lpTokens) {
    await rewardDistributor.newStakingPoolAndSetRewardRate(
      lpToken.address,
      rewardRates[lpTokens.indexOf(lpToken)],
      await getCurrentTimestamp()
    );
  }

  const stakingPoolAddresses: string[] =
    await rewardDistributor.getAllRecipients();

  const stakingPools = await Promise.all(
    stakingPoolAddresses.map(
      async (address) => await ethers.getContractAt("StakingPool", address)
    )
  );

  return { rewardDistributor, stakingPools };
}

export async function fixtureDefault() {
  // Get all accounts
  const [owner, ...accounts] = await ethers.getSigners();
  const ownerAddress = await owner.getAddress();

  const chainId = await getChainId();

  let df, veDFEscrow, veDF;
  if (chainId == 31337) {
    // Deploy DF mock token
    df = await deployContract("ERC20Mock", ["DF Mock Token", "DFM"]);
    await df.mint(await owner.getAddress(), ethers.utils.parseEther("100000"));

    // Deploy veDF manager mock
    veDFEscrow = await deployContract("veDFManagerMock", [df.address]);

    // TODO: Need a mock veDF contract
    veDF = veDFEscrow;
  } else {
    df = await getDFInstance();
    veDFEscrow = await getVEDFManagerInstance();
    await allocateDF(
      df,
      await owner.getAddress(),
      ethers.utils.parseEther("100000")
    );
    veDF = await getVEDFInstance();
  }

  const arbBridge = await deployContract("ArbiBridgeMock", [df.address]);

  // Deploy proxy admin contract
  const proxyAdmin = await deployContract("ProxyAdmin", []);

  // Deploy dfVoterProxy contract
  const voterImplFactory = await ethers.getContractFactory("DFVoterProxy");
  const voterImpl = await deployContract("DFVoterProxy", [
    df.address, // _df
    veDFEscrow.address, // _escrow
  ]);

  // Deploy the actual voter proxy
  const voterProxy = await deployContract("TransparentUpgradeableProxy", [
    voterImpl.address,
    proxyAdmin.address,
    "0x",
  ]);

  const voter = voterImplFactory.attach(voterProxy.address);
  await voter.initialize(
    df.address, // _df
    veDFEscrow.address // _escrow
  );

  const boosterL2 = await deployContract("BoosterL2", [df.address]);

  // Deploy booster contract
  const booster = await deployContract("Booster", [
    df.address,
    voter.address, // _staker
    arbBridge.address,
    arbBridge.address,
    boosterL2.address,
  ]);

  // Set booster as operator in dfVoterProxy
  await voter.setBooster(booster.address);

  // Use an EOA as reward factory contract.
  const rewardFactory = owner;

  // Deploy df depositor
  const depositor = await deployContract("DFDepositor", [
    df.address, // _df
    veDFEscrow.address, // _escrow
    voter.address, // _staker
    arbBridge.address, // _outbox, not used in test
  ]);

  // Set depositor in df voter proxy.
  await voter.setDepositor(depositor.address);

  // Init lock in depositor contract.
  // FIXME: Transfer some DF into voter for the initial lock
  // Should check out the real work flow here
  await faucetDF(df, voter.address, ethers.utils.parseEther("1000000"));
  // console.log(
  //   "balance of depositor:",
  //   (await df.balanceOf(voter.address)).toString()
  // );
  await depositor.initialLock();

  // Deploy treasury contract
  const treasury = await deployContract("TreasuryFunds", []);

  // Set treasury address in booster contract
  await booster.setTreasury(treasury.address);

  const apyHelper = await deployContract("APYHelper", []);

  // Loopfi Token is now on L1 and bridged to L2
  const loopfi = await deployContract("Loopfi", []);

  // Premine
  const perminedAmount = ethers.utils.parseEther("500000000"); // 500,000,000

  await loopfi.addMinters([ownerAddress], [perminedAmount]);

  return {
    owner,
    accounts,
    booster,
    df,
    veDFEscrow,
    voter,
    depositor,
    rewardFactory,
    apyHelper,
    treasury,
    veDF,
    loopfi,
    arbBridge,
    boosterL2,
  };
}

// NOTICE: just use all contracts from L1 to mock L2 to test.
export async function fixtureL2() {
  const results = await fixtureDefault();
  const { df, owner, accounts, depositor, boosterL2, loopfi, arbBridge } =
    results;
  const ownerAddress = await owner.getAddress();

  const pDFL2 = await deployContract("pDF", []);

  // Assuming the loopfi token is bridged on L2
  const lpfL2 = loopfi;

  const stakingPoolL2 = await deployContract("BaseRewardPool", [
    0, // pid_
    pDFL2.address, // stakingToken_
    df.address, // rewardToken_
    boosterL2.address, // operator_
  ]);

  const extraPoolL2 = await deployContract("VirtualBalanceRewardPool", [
    stakingPoolL2.address, // deposit_
    lpfL2.address, // rewardToken_
  ]);

  await stakingPoolL2.addExtraReward(extraPoolL2.address);

  // Transfer the reward
  const StakingRewardAmount = ethers.utils.parseEther("100000000"); // 100,000,000
  const thresholdAmount = ethers.utils.parseEther("1000");
  await lpfL2.mint(extraPoolL2.address, StakingRewardAmount);
  await extraPoolL2.queueNewRewards(StakingRewardAmount);

  const depositorL2 = await deployContract("DFDepositorL2", [
    df.address, // _l1DF
    df.address, // _l2DF
    pDFL2.address, // _minter
    stakingPoolL2.address, // _stakingPool
    arbBridge.address, // _arbGatewayRouter
    depositor.address, // _l1CounterParty
    thresholdAmount, // _lockThreshold
  ]);

  // Set operator in pDF contract.
  await pDFL2.setOperator(depositorL2.address);

  // The arb bridge does not need approve, but mock one does
  await depositorL2.approveX([df.address], [arbBridge.address], [MAX]);

  // Deploy lpf rewards pool
  const lpfRewardPoolL2 = await deployContract("LPFRewardPool", [
    lpfL2.address, // stakingToken_
    df.address, // rewardToken_
    depositorL2.address, // dfDeposits_
    stakingPoolL2.address, // pDFRewards_
    pDFL2.address, // pDF_
    boosterL2.address, // operator_
    await owner.getAddress(), // admin
  ]);

  // Set reward addresses in booster contract
  await boosterL2.setRewardContracts(
    stakingPoolL2.address,
    AddressZero
    // lpfRewardPoolL2.address
  );

  // Deploy master chef contract
  const lpincentives = ethers.utils.parseEther("25000000"); // 25,000,000
  const numberOfBlocks = ethers.BigNumber.from(6000 * 365 * 4);
  const rewardPerBlock = lpincentives.div(numberOfBlocks);
  const startBlock = await getBlock();
  const endbonusblock = startBlock + 2 * 7 * 6000; // about 2 weeks
  const chef = await deployContract("LPFMasterChef", [
    lpfL2.address, // _lpf
    rewardPerBlock, // _rewardPerBlock
    startBlock, // _startBlock
    endbonusblock, // _bonusEndBlock
  ]);

  // Deploy mocked LP pool: lpf-DF
  const lpfDFPairL2 = await deployContract("ERC20Mock", [
    "lpf-DF-Pair",
    "lpf-DF",
  ]);

  // Deploy mocked LP pool: lpf-USX
  const lpfUSXPairL2 = await deployContract("ERC20Mock", [
    "lpf-USX-Pair",
    "lpf-USX",
  ]);

  // Deploy mocked LP pool: pDF-DF
  const pDFDFPairL2 = await deployContract("ERC20Mock", [
    "pDF-DF-Pair",
    "pDF-DF",
  ]);

  // 10 mils per year
  const rewardRate = ethers.utils.parseEther("10000000").div(365 * 24 * 3600);
  const lps = [lpfDFPairL2, lpfUSXPairL2, pDFDFPairL2];

  // Note: the order of the staking pools may not be the same as the order of the lps
  const {
    rewardDistributor: rewardDistributorL2,
    stakingPools: lpStakingPoolsL2,
  } = await deployLiquidityMining(lpfL2, lps, [
    rewardRate,
    rewardRate,
    rewardRate,
  ]);

  await distributeAndApprove(accounts, df, depositor, lps, lpStakingPoolsL2);

  const LMAmount = ethers.utils.parseEther("100000000");
  // Send some lpf token to rewardDistributor as rewards
  await lpfL2.mint(rewardDistributorL2.address, LMAmount);

  const apyHelperL2 = await deployContract("APYHelper", []);

  return {
    ...results,
    chef,
    pDFL2,
    lpfL2,
    depositorL2,
    stakingPoolL2,
    extraPoolL2,
    apyHelperL2,
    lpfRewardPoolL2, // not used
    lpfDFPairL2,
    lpfUSXPairL2,
    pDFDFPairL2,
    rewardDistributorL2,
    lpStakingPoolsL2,
  };
}

export async function earmarkAndForwardRewards(booster: Contract) {
  // const earmarkData = booster.interface.encodeFunctionData("earmarkRewards", [
  //   0,
  // ]);

  // const forwardData = booster.interface.encodeFunctionData("forwardRewards", [
  //   0,
  //   0,
  //   "0x",
  // ]);

  // await booster.multicall([earmarkData, forwardData]);

  await booster.earmarkAndForward(0, 0, "0x");
}

export async function claimAndLock(
  depositor: Contract,
  bridge: Contract,
  df: Contract,
  user: Signer
) {
  // console.log(await df.balanceOf(bridge.address));

  const claimData = depositor.interface.encodeFunctionData("claimFunds", [
    0,
    ["0xecb9bdf346fa69c59c91e2aed20d585018bd0b9bbcadd2041f26d3ce4d196e35"],
    0,
    AddressZero,
    depositor.address,
    0,
    0,
    0,
    await df.balanceOf(bridge.address),
    "0x",
  ]);

  const lockData = depositor.interface.encodeFunctionData("lockDF", []);

  const res = await depositor
    .connect(user)
    .callStatic.multicall([claimData, lockData]);

  // console.log(
  //   "lock Incentive: ",
  //   BigNumber.from(res[res.length - 1]).toString()
  // );

  await depositor.connect(user).multicall([claimData, lockData]);
}
