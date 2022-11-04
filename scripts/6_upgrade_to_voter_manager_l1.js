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
    voterMaxBalance: ethers.utils.parseEther("3000000"),
  },
  rinkeby: {
    DF: "0x8C1D7E98F7D4449eb7aD42864d46389eE7518dB3",
    OUT_BOX_L1: "0x2360A33905dc1c72b12d975d975F42BaBdcef9F3",
    voterMaxBalance: ethers.utils.parseEther("3000000"),
  },
  goerli: {},
  kovan: {
    DF: "0x79E40d67DA6eAE5eB4A93Fc6a56A7961625E15F3",
    veDFManager: "0x7259153980146593E1128d3460f356eC08FC25A5",
    voterMaxBalance: ethers.utils.parseEther("3000000"),
  },
};

async function deployVoteManager() {
  const info = deployInfo[network[task.chainId]];
  const DF = info?.DF ? info.DF : task.deployments.DF.address;
  const veDFManager = info?.veDFManager
    ? info.veDFManager
    : task.deployments.veDFManager.address;

  task.contractsToDeploy = {
    DFVoterManagerImpl: {
      contract: "DFVoterManager",
      useProxy: false,
      getArgs: () => [DF, veDFManager, info.voterMaxBalance],
    },
  };

  await deployContracts(task);
}

async function upgradeVoter() {
  const info = deployInfo[network[task.chainId]];
  const voterMaxBalance = info.voterMaxBalance;

  const upgradeData =
    task.contracts.DFVoterManagerImpl.interface.encodeFunctionData(
      "upgrade(uint256)",
      [voterMaxBalance]
    );

  await sendTransaction(task, "proxyAdmin", "upgradeAndCall", [
    task.deployments.voter.address,
    task.deployments.DFVoterManagerImpl.address,
    upgradeData,
  ]);
}

async function setVoterMaxBalance(value) {
  await sendTransaction(task, "voter", "setVoterMaxBalance", [value]);
}

async function main() {
  // sendToTenderly(
  //   "0x60C7067edfc8c0aC22fab6772d37331D943543d3"
  // );

  await deployVoteManager();

  await upgradeVoter();
}

run(task, main);
