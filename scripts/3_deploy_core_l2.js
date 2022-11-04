import { run } from "./helpers/context";
import { deployContracts } from "./helpers/deploy";
import { sendTransaction, sendToTenderly } from "./helpers/transaction";

const task = { name: "Loopfi" };

const network = {
  1: "mainnet",
  5: "goerli",
  42: "kovan",
  69: "OpTest",
  42161: "arbitrum",
  421611: "arbTest",
};

const deployInfo = {
  mainnet: {},
  kovan: {},
  OpTest: {
    DEPOSITOR_L1: "0xc53F74c8a1896A4C22447384B3e992E9A29Fe49C",
    L1_CHAIN_ID: 5,
  },
  goerli: {
    DEPOSITOR_L1: "0xecEEa6C3339026F1Fe125832d39F53bCF1465C50",
    stakingAmount: ethers.utils.parseEther("100000000"), // 100,000,000
    L1_CHAIN_ID: 1, // place holder not used in test
  },
  arbitrum: {
    stakingAmount: ethers.utils.parseEther("100000000"), // 100,000,000
    crosschainThreshold: ethers.utils.parseEther("500000"), // 500,000
    L1_DF: "0x431ad2ff6a9C365805eBaD47Ee021148d6f7DBe0",
    L2_DF: "0xaE6aab43C4f3E0cea4Ab83752C278f8dEbabA689",
    Arb_Gateway_Router: "0x5288c571Fd7aD117beA99bF60FE0846C4E84F933",
    DEPOSITOR_L1: "0x60c467bD7ad8cBf963c4E52B115B3DDD296b5B89",
    lpf: "0x2794F519523709658D967166a78C5C5ad4E0247e",
  },
  arbTest: {
    stakingAmount: ethers.utils.parseEther("100000000"), // 100,000,000
    crosschainThreshold: ethers.utils.parseEther("1000"),
    L1_DF: "0x8C1D7E98F7D4449eb7aD42864d46389eE7518dB3",
    L2_DF: "0x6a671cC26EaBd652F2c745Ca83c4815f5066AC12",
    Arb_Gateway_Router: "0x9413AD42910c1eA60c737dB5f58d1C504498a3cD",
    DEPOSITOR_L1: "0x52edA2E6bf8B10D855A9bC9CdA6DAa311f9632C7",
    lpf: "0x504682EC7ff1E3d5dE6F8D524F4d167DFa797465",
  },
};

async function deployCore() {
  const info = deployInfo[network[task.chainId]];

  const Arb_Gateway_Router = info?.Arb_Gateway_Router;
  const DEPOSITOR_L1 = info?.DEPOSITOR_L1;
  const L1_DF = info?.L1_DF;
  const L2_DF = info?.L2_DF ? info.L2_DF : task.deployments.DF.address;
  const lpf = info?.lpf ? info.lpf : task.deployments.lpf.address;
  const crosschainThreshold = info?.crosschainThreshold;

  task.contractsToDeploy = {
    pDF: {
      contract: "pDF",
      path: "contracts/pTokens/",
      useProxy: false,
      getArgs: () => [],
    },
    pDFStaking: {
      contract: "BaseRewardPool",
      useProxy: false,
      getArgs: (deployments) => [
        0, // pid_
        deployments.pDF.address, // stakingToken_
        L2_DF, // rewardToken_
        deployments.booster.address, // operator_
      ],
    },
    pDFExtraReward: {
      contract: "VirtualBalanceRewardPool",
      useProxy: false,
      getArgs: (deployments) => [
        deployments.pDFStaking.address, // deposit_
        lpf, // rewardToken_
      ],
    },
    depositor: {
      contract: "DFDepositorL2",
      useProxy: false,
      getArgs: (deployments) => [
        L1_DF, // _l1DF
        L2_DF, // _l2DF
        deployments.pDF.address, // _minter
        deployments.pDFStaking.address, // _baseRewardPool
        Arb_Gateway_Router, // _arbGatewayRouter
        DEPOSITOR_L1, // _l1CounterParty
        crosschainThreshold, //_crosschainThreshold
      ],
    },
  };

  await deployContracts(task);
}

async function deployAPYHelper() {
  task.contractsToDeploy = {
    apyHelper: {
      contract: "APYHelper",
      useProxy: false,
      getArgs: () => [],
    },
  };

  await deployContracts(task);
}

async function coreConfig() {
  const info = deployInfo[network[task.chainId]];

  // sendToTenderly(
  //   "0x6b29b8af9AF126170513AE6524395E09025b214E"
  // );

  await sendTransaction(task, "pDF", "setOperator", [
    task.deployments.depositor.address,
  ]);

  await sendTransaction(task, "booster", "setRewardContracts", [
    task.deployments.pDFStaking.address,
    // task.deployments.lpfStaking.address,
    ethers.constants.AddressZero,
  ]);

  // Extra Reward for pDFStaking
  await sendTransaction(task, "pDFStaking", "addExtraReward", [
    task.contracts.pDFExtraReward.address,
  ]);

  // await sendTransaction(task, "lpf", "transfer", [
  //   task.contracts.pDFExtraReward.address,
  //   info.stakingAmount,
  // ]);

  // await sendTransaction(task, "pDFExtraReward", "queueNewRewards", [
  //   info.stakingAmount,
  // ]);
}

async function main() {
  await deployCore();

  // await deployAPYHelper();

  await coreConfig();
}

run(task, main);
