import { run } from "./helpers/context";
import { deployContracts } from "./helpers/deploy";
import { sendTransaction, sendToTenderly } from "./helpers/transaction";

const task = { name: "Loopfi" };

const network = {
  1: "mainnet",
  4: "rinkeby",
  5: "goerli",
  42: "kovan",
};

const deployInfo = {
  mainnet: {
    DF: "0x431ad2ff6a9C365805eBaD47Ee021148d6f7DBe0",
    veDFManager: "0xc0d7f11455aacD225c6fd1Be7dDF0bCf93b31cb3",
    OUT_BOX_L1: "0x760723CD2e632826c38Fef8CD438A4CC7E7E1A40",
  },
  rinkeby: {
    DF: "0x8C1D7E98F7D4449eb7aD42864d46389eE7518dB3",
    OUT_BOX_L1: "0x2360A33905dc1c72b12d975d975F42BaBdcef9F3",
  },
  goerli: {},
  kovan: {
    DF: "0x79E40d67DA6eAE5eB4A93Fc6a56A7961625E15F3",
    veDFManager: "0x7259153980146593E1128d3460f356eC08FC25A5",
  },
};

async function deployProxyAdmin() {
  task.contractsToDeploy = {
    proxyAdmin: {
      contract: "ProxyAdmin",
      path: "contracts/library/",
      useProxy: false,
      getArgs: () => [],
    },
  };

  await deployContracts(task);
}

async function deployMock() {
  const info = deployInfo[network[task.chainId]];
  const DF = info?.DF ? info.DF : task.deployments.DF.address;

  task.contractsToDeploy = {
    DF: {
      contract: "ERC20Mock",
      path: "contracts/mock/",
      useProxy: false,
      getArgs: () => ["DF Mock Token", "DFM"],
    },
    veDFManager: {
      contract: "veDFManagerMock",
      path: "contracts/mock/",
      useProxy: false,
      getArgs: (deployments) => [DF],
    },
  };

  await deployContracts(task);
}

async function deployCore() {
  const info = deployInfo[network[task.chainId]];

  const DF = info?.DF ? info.DF : task.deployments.DF.address;
  const veDFManager = info?.veDFManager
    ? info.veDFManager
    : task.deployments.veDFManager.address;

  const OUT_BOX_L1 = info?.OUT_BOX_L1;

  task.contractsToDeploy = {
    voter: {
      contract: "DFVoterProxy",
      useProxy: true,
      getArgs: (deployments) => [
        DF, // _df
        veDFManager, // _veDFManager
      ],
    },

    depositor: {
      contract: "DFDepositor",
      useProxy: false,
      getArgs: (deployments) => [
        DF, // _df
        veDFManager, // _veDFManager
        deployments.voter.address, // _staker
        OUT_BOX_L1,
      ],
    },
    treasury: {
      contract: "TreasuryFunds",
      useProxy: false,
      getArgs: () => [],
    },
    lpf: {
      contract: "Loopfi",
      useProxy: false,
      getArgs: () => [],
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
  await sendTransaction(task, "voter", "setDepositor", [
    task.deployments.depositor.address,
  ]);
}

async function initialLock() {
  // Should transfer some DF to voter
  await sendTransaction(task, "DF", "transfer", [
    task.deployments.voter.address,
    ethers.utils.parseEther("50"),
  ]);

  await sendTransaction(task, "depositor", "initialLock", []);
}

async function main() {
  // sendToTenderly(
  //   "0x6b29b8af9AF126170513AE6524395E09025b214E"
  // );

  await deployProxyAdmin();

  // await deployMock();

  await deployCore();

  // await deployAPYHelper();

  await coreConfig();

  await initialLock();
}

run(task, main);
