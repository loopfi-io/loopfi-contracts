import { run } from "./helpers/context";
import { deployContracts } from "./helpers/deploy";
import { sendTransaction, sendToTenderly } from "./helpers/transaction";
import { attachContractAtAdddress } from "./helpers/contract";

const task = { name: "Loopfi_Saddle" };

const network = {
  1: "mainnet",
  5: "goerli",
  42: "kovan",
  69: "OpTest",
  42161: "arbitrum",
};

const deployInfo = {
  mainnet: {
    totalSupply: ethers.utils.parseEther("1000000000"), // 1,000,000,000
    mintCap: ethers.utils.parseEther("500000000"), // 500,000,000
    premintAmount: ethers.utils.parseEther("500000000"), // 500,000,000
    verifyAmount: ethers.utils.parseEther("1000"), // 1000
    liquidityAmount: ethers.utils.parseEther("10000000"), // 10,000,000
    pools: {
      // pDFDF: {
      //   // address: "",
      //   // 1mil per year
      //   rewardRate: ethers.utils.parseEther("6849.3").div(24 * 3600),
      //   // startTime: 1654784159,
      // },
      LPFUSX: {
        address: "0xed4DD6aeAeCFC4d289A9578db12100b9a247DF2F",
        // 1mil per year
        rewardRate: 0,
        startTime: 1661850000,
      },
      // lpf: {
      //   // address: "",
      //   // 1mil per year
      //   rewardRate: ethers.utils.parseEther("2739.7").div(24 * 3600),
      //   // startTime: 1654784159,
      // },
    },
  },
  kovan: {
    totalSupply: ethers.utils.parseEther("1000000000"), // 1,000,000,000
    mintCap: ethers.utils.parseEther("500000000"), // 500,000,000
    premintAmount: ethers.utils.parseEther("500000000"), // 500,000,000
    liquidityAmount: ethers.utils.parseEther("10000000"), // 10,000,000
    pools: {
      pDFDF: {
        // address: "0x3ee035850c83d43fd2b8beee7e30120772d32787",
        // 1mil per year
        rewardRate: ethers.utils.parseEther("6849.3").div(24 * 3600),
        // startTime: 1654784159,
      },
      LPFUSX: {
        // address: "0x96CBf1E253556F077AFC5B13d801D8E38DF3A283",
        // 1mil per year
        rewardRate: ethers.utils.parseEther("4109.6").div(24 * 3600),
        // startTime: 1654784159,
      },
      lpf: {
        // address: "",
        // 1mil per year
        rewardRate: ethers.utils.parseEther("2739.7").div(24 * 3600),
        // startTime: 1654784159,
      },
    },
  },
  OpTest: {
    totalSupply: ethers.utils.parseEther("100000000"), // 100,000,000
    pools: {
      lpfDF: {
        // address: "",
        allocPoint: 50000,
        rewarder: ethers.constants.AddressZero,
        withUpdate: true,
      },
      lpfUSX: {
        // address: "",
        allocPoint: 30000,
        rewarder: ethers.constants.AddressZero,
        withUpdate: true,
      },
      pDFDF: {
        // address: "",
        allocPoint: 20000,
        rewarder: ethers.constants.AddressZero,
        withUpdate: true,
      },
    },
  },
  goerli: {
    lpf: "0x35170ef67d5231aA224Ae88ea3FB2592EaDC2e1b",
    stakingAmount: ethers.utils.parseEther("100000000"), // 100,000,000
    liquidityAmount: ethers.utils.parseEther("30000000"), // 30,000,000
    pools: {
      pDFDF: {
        // address: "",
        // 1mil per year
        rewardRate: ethers.utils.parseEther("20547.9").div(24 * 3600),
        // startTime: 1654784159,
      },
      LPFUSX: {
        // address: "",
        // 1mil per year
        rewardRate: ethers.utils.parseEther("12328.8").div(24 * 3600),
        // startTime: 1654784159,
      },
      lpf: {
        // address: "",
        // 1mil per year
        rewardRate: ethers.utils.parseEther("8219.2").div(24 * 3600),
        // startTime: 1654784159,
      },
    },
  },
  arbitrum: {
    DEPOSIT_PROXY_L2: "0xF67958dD04d25B72A27aF42C8d63810AE8b18A53",
    stakingAmount: ethers.utils.parseEther("100000000"), // 100,000,000
    liquidityAmount: ethers.utils.parseEther("30000000"), // 30,000,000
    lpf: "0x2794F519523709658D967166a78C5C5ad4E0247e",
    pools: {
      pDFDF: {
        // address: "",
        // 1mil per year
        rewardRate: ethers.utils.parseEther("20547.9").div(24 * 3600),
        // startTime: 1654784159,
      },
      LPFUSX: {
        // address: "",
        // 1mil per year
        rewardRate: ethers.utils.parseEther("12328.8").div(24 * 3600),
        // startTime: 1654784159,
      },
      lpf: {
        // address: "",
        // 1mil per year
        rewardRate: ethers.utils.parseEther("8219.2").div(24 * 3600),
        // startTime: 1654784159,
      },
    },
  },
};

async function deployMock() {
  task.contractsToDeploy = {
    pDFDF: {
      contract: "ERC20Mock",
      useProxy: false,
      getArgs: () => ["pDF-DF-Pair", "pDF-DF"],
    },
    LPFUSX: {
      contract: "ERC20Mock",
      useProxy: false,
      getArgs: () => ["LPF-USX-Pair", "LPF-USX"],
    },
    lpf: {
      contract: "ERC20Mock",
      useProxy: false,
      getArgs: () => ["LoopFi", "LPF"],
    },
  };

  await deployContracts(task);
}

// async function createPair() {
//   const pDFDFAddress = await task.uniswapFactory.callStatic.createPair(
//     task.contracts.DF.address,
//     task.contracts.pDF.address
//   );

//   await sendTransaction(task, "uniswapFactory", "createPair", [
//     task.contracts.DF.address,
//     task.contracts.pDF.address,
//   ]);

//   return;
// }

async function deployCore() {
  const info = deployInfo[network[task.chainId]];

  const lpf = info?.lpf ? info.lpf : task.deployments.lpf.address;

  task.contractsToDeploy = {
    rewardDistributor: {
      contract: "RewardDistributor",
      useProxy: true,
      getArgs: () => [lpf],
    },
  };

  await deployContracts(task);
}

async function coreConfig() {
  const info = deployInfo[network[task.chainId]];

  task.contracts.lpf = await attachContractAtAdddress(
    task.signer,
    info.lpf,
    "ERC20Mock",
    "contracts/mock"
  );

  // transfer rewards to reward distributor for liquidity
  await sendTransaction(task, "lpf", "transfer", [
    task.contracts.rewardDistributor.address,
    info.liquidityAmount,
  ]);
}

async function addLPPools() {
  const info = deployInfo[network[task.chainId]];
  // sendToTenderly(
  //   "0x6b29b8af9AF126170513AE6524395E09025b214E"
  // );

  for (const key in info.pools) {
    const config = info.pools[key];

    const address = config.address
      ? config.address
      : task.deployments[key].address;

    const startTime = config.startTime
      ? config.startTime
      : Math.floor(Date.now() / 1000);

    const stakingPoolAdress =
      await task.contracts.rewardDistributor.callStatic.newStakingPoolAndSetRewardRate(
        address,
        config.rewardRate,
        startTime
      );

    // console.log("stakingPoolAdress", stakingPoolAdress);

    task.deployments[`${key}Staking`] = {
      contract: "StakingPool",
      address: stakingPoolAdress,
    };

    await sendTransaction(
      task,
      "rewardDistributor",
      "newStakingPoolAndSetRewardRate",
      [address, config.rewardRate, startTime]
    );
  }
}

async function main() {
  // await deployMock();

  await deployCore();

  // await coreConfig();

  await addLPPools();
}

run(task, main);
