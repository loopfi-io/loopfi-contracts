import { run } from "./helpers/context";
import { deployContracts } from "./helpers/deploy";
import { faucetETH, faucetERC20 } from "./helpers/hardhat";

import { sendTransaction } from "./helpers/transaction";

const task = { name: "Loopfi_Velo" };

const network = {
  10: "optimism",
  31337: "optimism",
};

const deployInfo = {
  optimism: {
    VELO: "0x3c8B650257cFb5f272f799F5e2b4e65093a11a05",
    VEVELO: "0x9c7305eb78a432ced5C4D14Cac27E8Ed569A2e26",
    LPF: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", // OP DAI: 0xDA10xxx
    REWARD_DISTRIBUTOR: "0x5d5Bea9f0Fc13d967511668a60a3369fD53F784F",
    SNAPSHOT_DELEGATION: "0x469788fE6E9E9681C6ebF3bF78e7Fd26Fc015446",
    VOTER: "0x09236cfF45047DBee6B921e00704bed6D6B8Cf7e",
  },
};

async function verifyDepositVelo() {
  const amount = ethers.utils.parseEther("100");

  await faucetERC20(
    task.provider,
    deployInfo[network[task.chainId]].VELO,
    "0x9c7305eb78a432ced5c4d14cac27e8ed569a2e26",
    task.signerAddr,
    amount
  );

  await sendTransaction(task, "velo", "approve", [
    task.deployments.veDepositor.address,
    ethers.constants.MaxUint256,
  ]);

  await sendTransaction(task, "veDepositor", "depositTokens", [
    amount
  ]);
}

async function verifyDepositLP() {
  const amount = ethers.utils.parseEther("100");

  // await faucetERC20(
  //   task.provider,
  //   task.deployments.USXDFLP.address,
  //   "0x59Bc700Acd8826675C3B729794B1647978be2d7F",
  //   task.signerAddr,
  //   amount
  // );

  // await sendTransaction(task, "USXDFLP", "approve", [
  //   task.deployments.lpDepositor.address,
  //   ethers.constants.MaxUint256,
  // ]);

  await sendTransaction(task, "lpDepositor", "deposit", [
    task.deployments.USXDFLP.address,
    amount,
  ]);
}

async function faucet(address) {
  // await faucetETH(task.provider, address);

  const amount = ethers.utils.parseEther("1000")

  // Velo
  // await faucetERC20(
  //   task.provider,
  //   deployInfo[network[task.chainId]].VELO,
  //   "0x9c7305eb78a432ced5c4d14cac27e8ed569a2e26",
  //   address,
  //   ethers.utils.parseEther("100000")
  // );


  // await faucetERC20(
  //   task.provider,
  //   task.deployments.USXDFLP.address,
  //   "0x59Bc700Acd8826675C3B729794B1647978be2d7F",
  //   address,
  //   amount
  // );

  // VELO/OP
  await faucetERC20(
    task.provider,
    "0xFFD74EF185989BFF8752c818A53a47FC45388F08",
    "0x1F36f95a02C744f2B3cD196b5e44E749c153D3B9",
    address,
    amount
  );
}

async function main() {
  await faucet("0xeabC3c69688ddA466BCc08065fD0671f3f0B51a2"); // CTO
  await faucet("0xeA8224afDb5a53c2FE94CCcE38bE37CCFeCD29d1"); // Lp
  await faucet("0x95E111E87847Cdb3E3e9Bf16607A36099115dEC7"); // Oldwin

  // await verifyDepositVelo();

  // await verifyDepositLP();

  // await earmark();

  // await verifyGetReward();

  // await verifyLPFReward();

  // await checkIncentive();

  // await claimAndLock();
}

run(task, main);
