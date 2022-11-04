import { ethers, waffle, network, tenderly } from "hardhat";
import { deployContract } from "./fixtures";
import { getBlock, getTimestamp } from "./helper";
import { MAX, AddressZero } from "./constants";
import { BigNumber, Contract, Signer } from "ethers";
import { ChainId, getChainId } from "./fork";

// Use ethers provider instead of waffle's default MockProvider
export const loadFixture = waffle.createFixtureLoader([], waffle.provider);

let SDLInstance: Contract | undefined;
let veSDLInstance: Contract | undefined;
let LPFInstance: Contract | undefined;
let snapShotDelegationInstance: Contract | undefined;

interface ContractAddresses {
  SDL: string;
  VESDL: string;
  LPF: string;
  SNAPSHOT_DELEGATION: string;
}

const addresses: Record<ChainId, ContractAddresses> = {
  [ChainId.INVALID]: {
    SDL: AddressZero,
    VESDL: AddressZero,
    LPF: AddressZero,
    SNAPSHOT_DELEGATION: AddressZero,
  },
  [ChainId.MAINNET]: {
    SDL: "0xf1Dc500FdE233A4055e25e5BbF516372BC4F6871",
    VESDL: "0xD2751CdBED54B87777E805be36670D7aeAe73bb2",
    LPF: "0x3650B69f86cB593f116e276C30666834336c0647",
    SNAPSHOT_DELEGATION: "0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446",
  },
  [ChainId.KOVAN]: {
    SDL: AddressZero,
    VESDL: AddressZero,
    LPF: AddressZero,
    SNAPSHOT_DELEGATION: "0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446",
  },
  [ChainId.HARDHAT]: {
    SDL: AddressZero,
    VESDL: AddressZero,
    LPF: AddressZero,
    SNAPSHOT_DELEGATION: AddressZero,
  },
  [ChainId.OPTIMISM]: {
    SDL: AddressZero,
    VESDL: AddressZero,
    LPF: AddressZero,
    SNAPSHOT_DELEGATION: AddressZero,
  },
};

interface FaucetInfo {
  address: string;
  whale: string;
}

interface LPPoolInfo {
  token: string;
  gauge: string;
  stashVersion: number;
}

const lpInfo: Record<string, LPPoolInfo> = {
  saddleUSDV2: {
    token: "0x5f86558387293b6009d7896A61fcc86C17808D62",
    gauge: "0x7B2025Bf8c5ee8Baad9da8C3E3Ee45E96ed8b8EA",
    stashVersion: 3,
  },
  saddleD4: {
    token: "0xd48cF4D7FB0824CC8bAe055dF3092584d0a1726A",
    gauge: "0x702c1b8Ec3A77009D5898e18DA8F8959B6dF2093",
    stashVersion: 3,
  },
};

const faucetInfo: Record<string, FaucetInfo> = {
  SDL: {
    address: "0xf1Dc500FdE233A4055e25e5BbF516372BC4F6871",
    whale: "0xcb8efb0c065071e4110932858a84365a80c8fef0",
  },
  saddleUSDV2: {
    address: "0x5f86558387293b6009d7896A61fcc86C17808D62",
    whale: "0x7ce68b8796144c4fd1af5d82d79ed2cbaf8b1ea5",
  },
  saddleD4: {
    address: "0xd48cF4D7FB0824CC8bAe055dF3092584d0a1726A",
    whale: "0x6912a141ad1566f5da7515f522bb756a5a9e85e9",
  },
  LPF: {
    address: "0x3650B69f86cB593f116e276C30666834336c0647",
    whale: "0xa3A7B6F88361F48403514059F1F16C8E78d60EeC",
  },
  SDLETHSLP: {
    address: "0x0C6F06b32E6Ae0C110861b8607e67dA594781961",
    whale: "0xc64F8A9fe7BabecA66D3997C9d15558BF4817bE3",
  },
};

export async function faucetToken(
  symbol: string,
  to: string,
  amount: BigNumber
) {
  const whaleAddr = faucetInfo[symbol].whale;
  const token = await ethers.getContractAt("ERC20", faucetInfo[symbol].address);

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [whaleAddr],
  });

  const whale = await ethers.getSigner(whaleAddr);

  await network.provider.send("hardhat_setBalance", [
    whaleAddr,
    "0x1000000000000000000",
  ]);

  await token.connect(whale).transfer(to, amount);

  return token;
}

export async function allocateSDL(
  sdl: Contract,
  to: string,
  amount: BigNumber
) {
  await faucetToken("SDL", to, amount);
}

async function addWhiteList(checkerAddress: string, wallet: string) {
  const abi = [
    "function owner() view returns (address)",
    "function approveWallet(address wallet)",
  ];

  const checker = new ethers.Contract(checkerAddress, abi, ethers.provider);

  const owner = await checker.owner();

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [owner],
  });

  const ownerSigner = await ethers.getSigner(owner);

  await checker.connect(ownerSigner).approveWallet(wallet);
}

export async function getSDLInstance() {
  return SDLInstance
    ? SDLInstance
    : await ethers.getContractAt("ERC20", addresses[await getChainId()].SDL);
}

export async function getVESDLInstance() {
  return (
    veSDLInstance ||
    (await ethers.getContractAt("ERC20", addresses[await getChainId()].VESDL))
  );
}

export async function getLPFInstance() {
  return (
    LPFInstance ||
    (await ethers.getContractAt("ERC20", addresses[await getChainId()].LPF))
  );
}

export async function getSnapShotDelegationRegistry() {
  return (
    snapShotDelegationInstance ||
    (await ethers.getContractAt(
      "ISnapshotDelegate",
      addresses[await getChainId()].SNAPSHOT_DELEGATION
    ))
  );
}

async function distributeAndApprove(
  accounts: Signer[],
  sdl: Contract,
  depositor: Contract,
  tokens: Contract[],
  spenders: Contract[]
) {
  const faucetAmount = ethers.utils.parseEther("10000"); // 1,000,000
  await Promise.all(
    accounts.map(async (account) => {
      const address = await account.getAddress();

      await allocateSDL(sdl, address, faucetAmount);
      await sdl.connect(account).approve(depositor.address, 0);
      await sdl.connect(account).approve(depositor.address, MAX);

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

export async function fixtureDefault() {
  const [owner, ...accounts] = await ethers.getSigners();

  const SDL = await getSDLInstance();

  const veSDL = await getVESDLInstance();

  const pSDL = await deployContract("pSDL", []);

  const LPF = await getLPFInstance();

  const voter = await deployContract("SdlVoterProxy", []);

  const depositor = await deployContract("SdlDepositor", [
    voter.address, // _staker
    pSDL.address, // _minter
  ]);

  await pSDL.setOperator(depositor.address);
  await voter.setDepositor(depositor.address);

  // Add voter to Saddle' whitelist
  await addWhiteList(
    "0x4C6A2bE3D64048a0624568F91720a8f3884eBfd8",
    voter.address
  );

  await allocateSDL(SDL, voter.address, ethers.utils.parseEther("1"));
  await depositor.initialLock({ gasLimit: 1000000 });

  await distributeAndApprove(accounts, SDL, depositor, [], []);

  const booster = await deployContract("SdlBooster", [
    voter.address, // _staker
    LPF.address, // _minter
  ]);

  const pSDLStaking = await deployContract("SdlBaseRewardPool", [
    0, // pid_
    pSDL.address, // stakingToken_
    SDL.address, // rewardToken_
    booster.address, // operator_
    owner.address, // rewardManager
  ]);

  const tokenFactory = await deployContract("TokenFactory", [booster.address]);

  const rewardFactory = await deployContract("RewardFactory", [
    booster.address,
  ]);

  const proxyFactory = await deployContract("ProxyFactory", []);

  const stashFactory = await deployContract("StashFactoryV2", [
    booster.address,
    rewardFactory.address,
    proxyFactory.address,
  ]);

  const stashRewardV1 = await deployContract("ExtraRewardStashV1", []);
  const stashRewardV2 = await deployContract("ExtraRewardStashV2", []);
  const stashRewardV3 = await deployContract("ExtraRewardStashV3", []);
  await stashFactory.setImplementation(
    stashRewardV1.address,
    stashRewardV2.address,
    stashRewardV3.address
  );

  await voter.setOperator(booster.address);

  await booster.setFactories(
    rewardFactory.address,
    stashFactory.address,
    tokenFactory.address
  );

  // Add some LP pools
  await booster.addPool(
    lpInfo["saddleD4"].token,
    lpInfo["saddleD4"].gauge,
    lpInfo["saddleD4"].stashVersion
  );

  // Get LPF staking contract.
  const LPFStaking = await deployContract("LPFRewardPool", [
    LPF.address, // stakingToken_
    SDL.address, // rewardToken_
    depositor.address, // crvDeposits_
    pSDLStaking.address, // cvxCrvRewards_
    pSDL.address, // cvxCrvToken_
    booster.address, // operator_
    await owner.getAddress(), // rewardManager_
  ]);

  // Deploy VirtualBalanceWrapper contract as extra rewards.
  const LPFVirtualRewardPool = await deployContract(
    "SdlVirtualBalanceRewardPool",
    [
      LPFStaking.address, // deposit_
      LPF.address, // rewardToken_
      await owner.getAddress(), // operator_
    ]
  );

  // Add extra reward.
  LPFStaking.addExtraReward(LPFVirtualRewardPool.address);

  await booster.setRewardContracts(pSDLStaking.address, LPFStaking.address);

  // Deploy LPF locker contract
  const locker = await deployContract("LpfLocker", [
    LPF.address, // _stakingToken
    pSDL.address, // _cvxCrv
    pSDLStaking.address, // _cvxcrvStaking
  ]);

  // Deploy  Extra Reward Distribution contract for the locker contract.
  const lockerExtraReward = await deployContract(
    "vlCvxExtraRewardDistribution",
    [
      locker.address, // _locker
    ]
  );

  const LPFStakingProxy = await deployContract("LpfStakingProxy", [
    locker.address, // _rewards
    SDL.address, // _crv
    LPF.address, // _cvx
    pSDL.address, // _cvxCrv
    LPFStaking.address, // _cvxStaking
    pSDLStaking.address, // _cvxCrvStaking
    depositor.address, // _crvDeposit
  ]);

  // Make approval in LPF staking contract.
  await LPFStakingProxy.setApprovals();

  // Set staking contract in LPF Locker contract.
  await locker.setStakingContract(LPFStakingProxy.address);

  // Add default reward token in LPF Locker contract.
  await locker.addReward(
    pSDL.address, // _rewardsToken
    LPFStakingProxy.address, // _distributor
    true // _useBoost
  );

  // Approve to cvxcrvStaking to stake.
  await locker.setApprovals();

  // Deploy treasury contract.
  const treasury = await deployContract("TreasuryFunds", []);

  // Set treasury contract in locker contract.
  await locker.setBoost(
    1000, // _max: < 1500
    10000, // _rate: < 30000
    treasury.address // _receivingAddress
  );

  return {
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
    LPFStaking,
    LPFVirtualRewardPool,
    locker,
    LPFStakingProxy,
    treasury,
    lockerExtraReward,
    rewardFactory,
  };
}
