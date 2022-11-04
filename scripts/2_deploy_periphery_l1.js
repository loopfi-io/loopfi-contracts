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
    totalSupply: ethers.utils.parseEther("1000000000"), // 1,000,000,000
    mintCap: ethers.utils.parseEther("500000000"), // 500,000,000
    premintAmount: ethers.utils.parseEther("500000000"), // 500,000,000
    verifyAmount: ethers.utils.parseEther("1000"), // 1000
    liquidityAmount: ethers.utils.parseEther("10000000"), // 10,000,000
    DF: "0x431ad2ff6a9C365805eBaD47Ee021148d6f7DBe0",
    Custom_Gateway_L1: "0xa3A7B6F88361F48403514059F1F16C8E78d60EeC",
    Gateway_Router_L1: "0x72Ce9c846789fdB6fC1f34aC4AD25Dd9ef7031ef",
    BOOSTER_L2: "0x47159D2c877b9608D7A194a041d01649fE984B38",
  },
  rinkeby: {
    totalSupply: ethers.utils.parseEther("1000000000"), // 1,000,000,000
    mintCap: ethers.utils.parseEther("500000000"), // 500,000,000
    premintAmount: ethers.utils.parseEther("500000000"), // 500,000,000
    verifyAmount: ethers.utils.parseEther("1000"), // 1000
    liquidityAmount: ethers.utils.parseEther("10000000"), // 10,000,000
    DF: "0x8C1D7E98F7D4449eb7aD42864d46389eE7518dB3",
    Custom_Gateway_L1: "0x91169Dbb45e6804743F94609De50D511C437572E",
    Gateway_Router_L1: "0x70C143928eCfFaf9F5b406f7f4fC28Dc43d68380",
    BOOSTER_L2: "0xF5A838fa72c77Dd3E8D4fEfe6862697CF1D5fC14",
  },
  goerli: {
    BOOSTER_L2: "0xaEa1984C10e46877bd4015081244Ab01cb314e22",
  },
  kovan: {
    DF: "0x79E40d67DA6eAE5eB4A93Fc6a56A7961625E15F3",
    BOOSTER_L2: "0xA671198aC02b668b33F70A13131aC3175f60D100",
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
  };

  await deployContracts(task);
}

async function deployPeriphery() {
  const info = deployInfo[network[task.chainId]];

  const DF = info?.DF ? info.DF : task.deployments.DF.address;
  const BOOSTER_L2 = info?.BOOSTER_L2;

  const Custom_Gateway_L1 = info?.Custom_Gateway_L1;
  const Gateway_Router_L1 = info?.Gateway_Router_L1;

  task.contractsToDeploy = {
    booster: {
      contract: "Booster",
      useProxy: false,
      getArgs: (deployments) => [
        DF,
        deployments.voter.address, // _staker
        Custom_Gateway_L1,
        Gateway_Router_L1,
        BOOSTER_L2,
      ],
    },
  };

  await deployContracts(task);
}

async function configPeriphery() {
  // await sendTransaction(task, "booster__", "shutdownSystem", []);

  await sendTransaction(task, "voter", "setBooster", [
    task.deployments.booster.address,
  ]);

  await sendTransaction(task, "booster", "setTreasury", [
    task.deployments.treasury.address,
  ]);
}

async function mintLoopfi() {
  await sendTransaction(task, "lpf", "addMinters", [
    [task.signerAddr],
    [info.mintCap],
  ]);

  // premint
  await sendTransaction(task, "lpf", "mint", [
    task.signerAddr,
    info.verifyAmount,
  ]);

  // await sendTransaction(task, "lpf", "mint", [
  //   task.signerAddr,
  //   info.premintAmount,
  // ]);
}

async function main() {
  // sendToTenderly(
  //   "0x6b29b8af9AF126170513AE6524395E09025b214E"
  // );

  // await deployMock();

  await deployPeriphery();

  await configPeriphery();

  // await mintLoopfi();
}

run(task, main);
