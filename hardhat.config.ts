import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "hardhat-abi-exporter";

import * as tdly from "@tenderly/hardhat-tenderly";
// tdly.setup();

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  mocha: {
    timeout: 2000000,
  },
  networks: {
    hardhat: {
      forking: {
        // url: "https://eth-mainnet.alchemyapi.io/v2/" + process.env.ALCHEMY_KEY,
        // blockNumber: 15209978,
        url: "https://opt-mainnet.g.alchemy.com/v2/" + process.env.ALCHEMY_KEY,
        blockNumber: 23095000,
        //   // url: "https://eth-kovan.alchemyapi.io/v2/PxsXj0GV165_KYcXXvntiGzEUhYFHIOr",
        //   // blockNumber: 31274187,
      },
    },
    "truffle-dashboard": {
      url: "http://localhost:24012/rpc",
      timeout: 500000,
    },
    ropsten: {
      url: process.env.ROPSTEN_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    kovan: {
      url: process.env.KOVAN_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gas: 8000000,
    },
    goerli: {
      url: process.env.GOERLI_URL || "",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gas: 8000000,
    },
    tenderly: {
      url: `https://rpc.tenderly.co/fork/${process.env.TENDERLY_FORK_ID}`,
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gas: 8000000,
    },
    dforcefork: {
      url: "https://rpc.dforce.network/9007/",
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
      gas: 8000000,
      timeout: 500000,
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.6.12",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.11",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  abiExporter: {
    runOnCompile: true,
    clear: true,
    flat: true,
    only: [
      "IDFDepositor",
      "IBaseRewardPool",
      "IDepositProxyL2",
      "IRewardDistributorL2",
      "APYHelper",
      "ILPFMasterChef",
      "ILPFRewardPool",
      "ISdlDepositor",
      "ISdlBaseRewardPool",
      "ISdlBooster",
      "ILockedCvx",
      "IStakingProxy",
      "ISnapshotDelegate",
      // Velodrome
      "VeDepositor",
      "StakingRewards",
      "LpDepositor",
      "TokenLocker",
    ],
    spacing: 2,
    pretty: false,
  },
};

export default config;
