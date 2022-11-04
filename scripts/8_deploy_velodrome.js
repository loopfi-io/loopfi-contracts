import { run } from "./helpers/context";
import { deployContracts } from "./helpers/deploy";
import { faucetETH, faucetERC20 } from "./helpers/hardhat";

import {
  sendTransaction,
  sendTransactionInsteadOfPrint,
  sendToTenderly,
} from "./helpers/transaction";

const task = { name: "Loopfi_Velo" };

const network = {
  10: "optimism",
  31337: "optimism",
};

const deployInfo = {
  optimism: {
    VELO: "0x3c8B650257cFb5f272f799F5e2b4e65093a11a05",
    VEVELO: "0x9c7305eb78a432ced5C4D14Cac27E8Ed569A2e26",
    // LPF: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", // OP DAI: 0xDA10xxx
    LPF: "0x0B3e851cf6508A16266BC68A651ea68b31ef673b", // OP LPF
    REWARD_DISTRIBUTOR: "0x5d5Bea9f0Fc13d967511668a60a3369fD53F784F",
    SNAPSHOT_DELEGATION: "0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446",
    VOTER: "0x09236cfF45047DBee6B921e00704bed6D6B8Cf7e",
  },
};

async function deploy() {
  const info = deployInfo[network[task.chainId]];

  task.contractsToDeploy = {
    proxyAdmin: {
      contract: "ProxyAdmin",
      path: "contracts/library/",
      useProxy: false,
      getArgs: () => [],
    },
    veDepositor: {
      contract: "VeDepositor",
      path: "contracts/velodrom/",
      useProxy: true,
      getArgs: () => [
        info.VELO, // _token
        info.VEVELO, // _votingEscrow,
        info.REWARD_DISTRIBUTOR, // _veDist
      ],
      constructWithArgs: false,
    },
    lpDepositor: {
      contract: "LpDepositor",
      path: "contracts/velodrom/",
      useProxy: true,
      getArgs: () => [
        info.VELO, // _token
        info.VEVELO, // _votingEscrow,
        info.VOTER, // _veloVoter
      ],
      constructWithArgs: false,
    },
    lpDepositToken: {
      contract: "LpDepositToken",
      path: "contracts/velodrom/",
      useProxy: false,
      getArgs: () => [],
    },
    pVeloStaking: {
      contract: "StakingRewards",
      path: "contracts/velodrom/",
      useProxy: true,
      getArgs: () => [],
      constructWithArgs: false,
    },
    treasuryFunds: {
      contract: "TreasuryFunds",
      path: "contracts/velodrom/",
      useProxy: true,
      getArgs: () => [],
      constructWithArgs: false,
    },
    // TODO:
    // virtualBalanceRewardPool: {
    //   contract: "GaugeVirtualBalanceRewardPool",
    //   path: "contracts/velodrom/",
    //   useProxy: false,
    //   getArgs: () => [
    //     task.deployments.lpDepositor.address, // deposit_
    //     // TODO: extra reward pool
    //     "", // pool_
    //     info.LPF, // reward_
    //   ],
    //   constructWithArgs: false,
    // },
  };

  await deployContracts(task);
}

async function config() {
  const info = deployInfo[network[task.chainId]];

  // Initialize LP token implementation.
  await sendTransaction(task, "lpDepositToken", "initialize", [
    "0xFFD74EF185989BFF8752c818A53a47FC45388F08", // Velo-OP LP
  ]);

  // Set config in pVeloStaking contract.
  await sendTransaction(task, "pVeloStaking", "setAddresses", [
    task.deployments.veDepositor.address, // _stakingToken,
    // TODO:
    [info.VELO, info.LPF], // address[2] _rewardTokens
    [86400 * 7, 86400 * 7 * 52], // address[2] _durations
  ]);

  await sendTransaction(task, "veDepositor", "setAddresses", [
    task.deployments.lpDepositor.address, // _lpDepositor,
    task.deployments.treasuryFunds.address, // _treasuryFunds
  ]);

  await sendTransaction(task, "lpDepositor", "setAddresses", [
    info.LPF, // _lpf,
    task.deployments.veDepositor.address, // _pVELO,
    task.signerAddr, // _loopfiVoter,
    task.deployments.treasuryFunds.address, // _treasuryFunds
    task.deployments.pVeloStaking.address, // _pVeloStaking,
    task.deployments.lpDepositToken.address, // _depositToken,
    task.signerAddr, // _teamRewards,
    task.signerAddr, // _investorsRewards
  ]);

  // TODO:
  // // Add virtual reward pool for LP gauge.
  // await sendTransaction(task, "lpDepositor", "addExtraReward", [
  //   "", // LP gauge
  //   task.deployments.virtualBalanceRewardPool.address,
  // ]);
}

async function initialLock() {
  await sendTransaction(task, "velo", "approve", [
    task.deployments.veVELO.address,
    ethers.constants.MaxUint256,
  ]);

  const lockAmount = await task.contracts.velo.balanceOf(task.signerAddr);
  const lockDuration = 126142880; // about 4 years
  const tokenId = await task.contracts.veVELO.callStatic.create_lock(
    lockAmount,
    lockDuration
  );

  await sendTransaction(task, "veVELO", "create_lock", [
    lockAmount,
    lockDuration,
  ]);

  // console.log("Token ID : ", tokenId);

  await sendTransaction(task, "veVELO", "safeTransferFrom", [
    task.signerAddr,
    task.deployments.veDepositor.address,
    tokenId,
  ]);

  console.log(
    "Token ID : ",
    (await task.contracts.veDepositor.tokenID()).toString()
  );
}

async function main() {
  // await faucetETH(task.provider, task.signerAddr);

  // await faucetERC20(
  //   task.provider,
  //   deployInfo[network[task.chainId]].VELO,
  //   "0x9c7305eb78a432ced5c4d14cac27e8ed569a2e26",
  //   task.signerAddr,
  //   ethers.utils.parseEther("100000")
  // );

  // await deploy();

  // await config();

  // await initialLock();

  // await addLPPool();

  // await queueLPFExtraReward();
}

run(task, main);
