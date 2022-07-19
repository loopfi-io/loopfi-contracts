import { run } from "./helpers/context";
import { deployContracts } from "./helpers/deploy";

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
  goerli: {},
  OpTest: {},
  arbitrum: {
    DF: "0xaE6aab43C4f3E0cea4Ab83752C278f8dEbabA689",
  },
  arbTest: {
    DF: "0x6a671cC26EaBd652F2c745Ca83c4815f5066AC12",
  },
};

async function deployMock() {
  task.contractsToDeploy = {
    cBridge: {
      contract: "CBridgeMock",
      path: "contracts/mock/",
      useProxy: false,
      getArgs: () => [],
    },
    DF: {
      contract: "ERC20Mock",
      path: "contracts/mock/",
      useProxy: false,
      getArgs: () => ["DF Mock Token", "DFM"],
    },
  };

  await deployContracts(task);
}

async function deployDependency() {
  const info = deployInfo[network[task.chainId]];
  const DF = info?.DF ? info.DF : task.deployments.DF.address;

  task.contractsToDeploy = {
    booster: {
      contract: "BoosterL2",
      useProxy: false,
      getArgs: () => [
        DF, // L2 DF
      ],
    },
  };

  await deployContracts(task);
}

async function main() {
  // await deployMock();

  await deployDependency();
}

run(task, main);
