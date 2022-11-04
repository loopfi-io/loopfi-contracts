import { ethers, waffle, network, tenderly } from "hardhat";
import { expect } from "chai";
import { deployContract } from "./fixtures";
import { getBlock, getTimestamp } from "./helper";
import { MAX, AddressZero } from "./constants";
import { BigNumber, Contract, Signer } from "ethers";
import { ChainId, getChainId } from "./fork";

// Use ethers provider instead of waffle's default MockProvider
export const loadFixture = waffle.createFixtureLoader([], waffle.provider);

let VeloInstance: Contract | undefined;
let veVeloInstance: Contract | undefined;
let LPFInstance: Contract | undefined;
let MinterInstance: Contract | undefined;
let OPInstance: Contract | undefined;
let RouterInstance: Contract | undefined;
let snapShotDelegationInstance: Contract | undefined;
let VoterInstance: Contract | undefined;
let veDistributorInstance: Contract | undefined;

interface ContractAddresses {
  VELO: string;
  VEVELO: string;
  LPF: string;
  MINTER: string;
  OP: string;
  Router: string;
  REWARD_DISTRIBUTOR: string;
  SNAPSHOT_DELEGATION: string;
  VOTER: string;
}

// const REWARD_DISTRIBUTOR = "0x5d5Bea9f0Fc13d967511668a60a3369fD53F784F";
const VOTER = "0x09236cfF45047DBee6B921e00704bed6D6B8Cf7e";
const FixedVotePools = [
  "0xFFD74EF185989BFF8752c818A53a47FC45388F08", // Velo-OP LP
  "0xf8eDF2Da8FcF610Cf77235D3F90CC110723159Aa", // USX-DF LP
];

const addresses: Record<ChainId, ContractAddresses> = {
  [ChainId.INVALID]: {
    VELO: AddressZero,
    VEVELO: AddressZero,
    LPF: AddressZero,
    MINTER: AddressZero,
    OP: AddressZero,
    Router: AddressZero,
    REWARD_DISTRIBUTOR: AddressZero,
    SNAPSHOT_DELEGATION: AddressZero,
    VOTER: AddressZero,
  },
  [ChainId.MAINNET]: {
    VELO: AddressZero,
    VEVELO: AddressZero,
    LPF: "0x3650B69f86cB593f116e276C30666834336c0647",
    MINTER: AddressZero,
    OP: AddressZero,
    Router: AddressZero,
    REWARD_DISTRIBUTOR: AddressZero,
    SNAPSHOT_DELEGATION: "0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446",
    VOTER: AddressZero,
  },
  [ChainId.KOVAN]: {
    VELO: AddressZero,
    VEVELO: AddressZero,
    LPF: AddressZero,
    MINTER: AddressZero,
    OP: AddressZero,
    Router: AddressZero,
    REWARD_DISTRIBUTOR: AddressZero,
    SNAPSHOT_DELEGATION: "0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446",
    VOTER: AddressZero,
  },
  [ChainId.HARDHAT]: {
    VELO: AddressZero,
    VEVELO: AddressZero,
    LPF: AddressZero,
    MINTER: AddressZero,
    OP: AddressZero,
    Router: AddressZero,
    REWARD_DISTRIBUTOR: AddressZero,
    SNAPSHOT_DELEGATION: AddressZero,
    VOTER: AddressZero,
  },
  [ChainId.OPTIMISM]: {
    VELO: "0x3c8B650257cFb5f272f799F5e2b4e65093a11a05",
    VEVELO: "0x9c7305eb78a432ced5C4D14Cac27E8Ed569A2e26",
    LPF: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", // OP DAI: 0xDA10xxx
    MINTER: "0x3460Dc71A8863710D1C907B8d9D5DBC053a4102d", // Velo minter
    OP: "0x4200000000000000000000000000000000000042",
    Router: "0x9c12939390052919aF3155f41Bf4160Fd3666A6f", // Velo Router
    REWARD_DISTRIBUTOR: "0x5d5Bea9f0Fc13d967511668a60a3369fD53F784F",
    SNAPSHOT_DELEGATION: "0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446",
    VOTER: "0x09236cfF45047DBee6B921e00704bed6D6B8Cf7e",
  },
};

interface FaucetInfo {
  address: string;
  whale: string;
}

const faucetInfo: Record<string, FaucetInfo> = {
  VELO: {
    address: "0x3c8B650257cFb5f272f799F5e2b4e65093a11a05",
    whale: "0x9c7305eb78a432ced5C4D14Cac27E8Ed569A2e26",
  },
  OP: {
    address: "0x4200000000000000000000000000000000000042",
    whale: "0x2A82Ae142b2e62Cb7D10b55E323ACB1Cab663a26",
  },
  velo_op: {
    address: "0xFFD74EF185989BFF8752c818A53a47FC45388F08",
    whale: "0x1F36f95a02C744f2B3cD196b5e44E749c153D3B9",
  },
  usx_df: {
    address: "0xf8eDF2Da8FcF610Cf77235D3F90CC110723159Aa",
    whale: "0x59Bc700Acd8826675C3B729794B1647978be2d7F",
  },
  // OP DAI: 0xDA10
  LPF: {
    address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    whale: "0x82E64f49Ed5EC1bC6e43DAD4FC8Af9bb3A2312EE",
  },
  saddleUSDV2: {
    address: "0x5f86558387293b6009d7896A61fcc86C17808D62",
    whale: "0x7ce68b8796144c4fd1af5d82d79ed2cbaf8b1ea5",
  },
  saddleD4: {
    address: "0xd48cF4D7FB0824CC8bAe055dF3092584d0a1726A",
    whale: "0x6912a141ad1566f5da7515f522bb756a5a9e85e9",
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
    "0x1000000000000000000", // 4722.36 eth
  ]);

  await token.connect(whale).transfer(to, amount);

  return token;
}

export async function allocateVELO(
  sdl: Contract,
  to: string,
  amount: BigNumber
) {
  await faucetToken("VELO", to, amount);
}

export async function getVeloMinterInstance() {
  return (
    MinterInstance ||
    (await ethers.getContractAt(
      "IBaseV1Minter",
      addresses[await getChainId()].MINTER
    ))
  );
}

export async function getOPInstance() {
  return (
    OPInstance ||
    (await ethers.getContractAt("ERC20", addresses[await getChainId()].OP))
  );
}

export async function getRouterInstance() {
  return (
    RouterInstance ||
    (await ethers.getContractAt(
      "IRouter",
      addresses[await getChainId()].Router
    ))
  );
}

export async function getVELOInstance() {
  return (
    VeloInstance ||
    (await ethers.getContractAt("ERC20", addresses[await getChainId()].VELO))
  );
}

export async function getVoterInstance() {
  return (
    VoterInstance ||
    (await ethers.getContractAt(
      "IBaseV1Voter",
      addresses[await getChainId()].VOTER
    ))
  );
}

export async function getERC20Instance(contractAddress: string) {
  return await ethers.getContractAt("ERC20", contractAddress);
}

export async function getVEVELOInstance() {
  return (
    veVeloInstance ||
    (await ethers.getContractAt(
      "IVotingEscrow",
      addresses[await getChainId()].VEVELO
    ))
  );
}

export async function getVEDistributor() {
  return (
    veDistributorInstance ||
    (await ethers.getContractAt(
      "IVeDist",
      addresses[await getChainId()].REWARD_DISTRIBUTOR
    ))
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

export async function allocateToken(
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

async function distributeAndApprove(
  accounts: Signer[],
  velo: Contract,
  depositor: Contract,
  tokens: Contract[],
  spenders: Contract[]
) {
  const faucetAmount = ethers.utils.parseEther("1000000"); // 1,000,000
  await Promise.all(
    accounts.map(async (account) => {
      const address = await account.getAddress();

      await faucetToken("VELO", address, faucetAmount);
      await faucetToken("LPF", address, faucetAmount);
      await faucetToken("OP", address, faucetAmount);
      await velo.connect(account).approve(depositor.address, 0);
      await velo.connect(account).approve(depositor.address, MAX);

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
  const user10 = accounts[10];
  const user10Address = await user10.getAddress();

  const VELO = await getVELOInstance();

  const OP = await getOPInstance();

  const veVELO = await getVEVELOInstance();

  const veDistributor = await getVEDistributor();

  const LPF = await getLPFInstance();

  const veloMiner = await getVeloMinterInstance();

  const Router = await getRouterInstance();

  const voter = await getVoterInstance();

  // TODO: Almost all of the following contracts need a proxy.
  const veDepositor = await deployContract("VeDepositor", []);
  await veDepositor.initialize(
    VELO.address, // _token
    veVELO.address, // _votingEscrow,
    veDistributor.address // _veDist
  );

  const lpDepositor = await deployContract("LpDepositor", []);
  // Initialize lpDepositor contract.
  await lpDepositor.initialize(
    VELO.address, // _dddx
    veVELO.address, // _votingEscrow,
    VOTER // _dddxVoter
  );

  // await lpDepositor.whitelistProtocolTokens();

  const VELOOPLP = await getERC20Instance(FixedVotePools[0]);
  const USXDFLP = await getERC20Instance(FixedVotePools[1]);

  const veloOpFaucetAmount = ethers.utils.parseEther("50000"); // 50k
  const usxDFFaucetAmount = ethers.utils.parseEther("10000"); // 10k
  await Promise.all(
    accounts.map(async (account) => {
      const address = await account.getAddress();

      await faucetToken("velo_op", address, veloOpFaucetAmount);
      await faucetToken("usx_df", address, usxDFFaucetAmount);

      await VELOOPLP.connect(account).approve(lpDepositor.address, MAX);
      await USXDFLP.connect(account).approve(lpDepositor.address, MAX);
    })
  );

  // Got some faucet token and approve.
  await distributeAndApprove(accounts, VELO, veDepositor, [], []);

  // TODO: This is an implementation contract, do not need a proxy.
  const lpDepositToken = await deployContract("LpDepositToken", []);

  const stakingRewards = await deployContract("StakingRewards", []);
  // Initialize stakingRewards contract.
  await stakingRewards.initialize();
  // Set config in stakingRewards contract.
  await stakingRewards.setAddresses(
    veDepositor.address, // _stakingToken,
    [VELO.address, LPF.address], // address[2] _rewardTokens
    [86400 * 7, 86400 * 7 * 52] // address[2] _durations: [7 days, 365 days]
  );

  const lpfLocker = await deployContract("TokenLocker", []);
  // Initialize stakingRewards contract.
  await lpfLocker.initialize(
    16 // _maxLockWeeks
  );
  // Set config in lpfLocker contract.
  await lpfLocker.setAddresses(LPF.address);

  // Approve to locker contract.
  await Promise.all(
    accounts.map(async (account) => {
      const address = await account.getAddress();

      await LPF.connect(account).approve(lpfLocker.address, MAX);
    })
  );

  // const feeDistributor = await deployContract("FeeDistributor", []);
  // // Initialize feeDistributor contract.
  // await feeDistributor.initialize();
  // // Set config in feeDistributor contract
  // await feeDistributor.setAddresses(lpfLocker.address);

  const treasury = await deployContract("TreasuryFunds", []);

  const doubleVoter = await deployContract("DoubleVoter", []);
  // Initialize doubleVoter contract.
  await doubleVoter.initialize(
    VOTER // _voter
  );
  // TODO:
  // Set config in feeDistributor contract
  await doubleVoter.setAddresses(
    lpfLocker.address, // _tokenLocker,
    veDepositor.address, // _veDepositor,
    FixedVotePools //   address[2] _fixedVotePools
  );

  // Deploy gauge virtual balance reward pool
  const USXDFVirtualRewardPool = await deployContract(
    "GaugeVirtualBalanceRewardPool",
    [lpDepositor.address, USXDFLP.address, LPF.address]
  );
  // Add virtual reward pool for USX-DF pool.
  await lpDepositor.addExtraReward(
    "0xf8eDF2Da8FcF610Cf77235D3F90CC110723159Aa", // USX-DF pool
    USXDFVirtualRewardPool.address // USX-DF pool
  );

  // Set config in veDepositor contract.
  await veDepositor.setAddresses(
    lpDepositor.address, // _lpDepositor,
    // doubleVoter.address, // _doubleVoter,
    treasury.address // _treasury
  );

  // Set config in lpDepositor contract.
  await lpDepositor.setAddresses(
    LPF.address, // _dou,
    veDepositor.address, // _dddxdou,
    // doubleVoter.address, // _doubleVoter,
    user10Address, // EOA account,
    treasury.address, // _treasury
    stakingRewards.address, // _stakingRewards,
    // owner.address, // _tokenWhitelister,
    lpDepositToken.address, // _depositToken,
    owner.address, // _teamRewards,
    owner.address // _investorsRewards
  );

  // Prepare for the whole system:
  // Transfer veVelo NFT to veDepositor contract to start.
  const lockAmount = ethers.utils.parseEther("20000");
  const lockDuration = 126142880; // about 4 years

  await VELO.connect(user10).approve(veVELO.address, MAX);

  const tokenId = await veVELO
    .connect(user10)
    .callStatic.create_lock(lockAmount, lockDuration);

  await veVELO.connect(user10).create_lock(lockAmount, lockDuration);

  let veNFTOwner = await veVELO.ownerOf(tokenId);
  expect(veNFTOwner).to.eq(user10Address);

  // Transfer veVelo NFT to veDepositor contract.
  veVELO
    .connect(user10)
    .safeTransferFrom(user10Address, veDepositor.address, tokenId);

  veNFTOwner = await veVELO.ownerOf(tokenId);
  expect(veNFTOwner).to.not.eq(user10Address);
  expect(veNFTOwner).to.eq(lpDepositor.address);

  const veDepositorTokenId = await veDepositor.tokenID();
  expect(veDepositorTokenId).to.eq(tokenId);

  return {
    accounts,
    doubleVoter,
    // feeDistributor,
    lpDepositor,
    LPF,
    lpfLocker,
    OP,
    owner,
    Router,
    stakingRewards,
    tokenId,
    treasury,
    USXDFLP,
    USXDFVirtualRewardPool,
    veDepositor,
    veDistributor,
    VELO,
    veloMiner,
    VELOOPLP,
    veVELO,
    voter,
  };
}
