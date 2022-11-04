import { run } from "./helpers/context";
import { sendTransaction, sendToTenderly } from "./helpers/transaction";
import { faucetETH, faucetERC20 } from "./helpers/tenderly";
// import { faucetETH, faucetERC20 } from "./helpers/hardhat";

let task = { name: "Loopfi_Saddle" };

const network = {
  1: "mainnet",
};

let deployInfo = {
  mainnet: {
    SDL: "0xf1Dc500FdE233A4055e25e5BbF516372BC4F6871",
    veSDL: "0xD2751CdBED54B87777E805be36670D7aeAe73bb2",
    LPF: "0x3650B69f86cB593f116e276C30666834336c0647",
    saddleD4: "0xd48cF4D7FB0824CC8bAe055dF3092584d0a1726A",
  },
};

async function verifyDepositSDL() {
  const amount = ethers.utils.parseEther("100");

  await faucetERC20(
    task.provider,
    deployInfo[network[task.chainId]].SDL,
    "0xcb8efb0c065071e4110932858a84365a80c8fef0",
    task.signerAddr,
    amount
  );

  await sendTransaction(task, "SDL", "approve", [
    task.deployments.depositor.address,
    ethers.constants.MaxUint256,
  ]);

  await sendTransaction(task, "depositor", "deposit(uint256,bool,address)", [
    amount,
    false,
    ethers.constants.AddressZero,
  ]);

  await sendTransaction(task, "depositor", "deposit(uint256,bool,address)", [
    amount,
    false,
    task.deployments.pSDLStaking.address,
  ]);

  // console.log(
  //   (await task.contracts.pSDLStaking.balanceOf(task.signerAddr)).toString()
  // );

  await sendTransaction(task, "depositor", "deposit(uint256,bool,address)", [
    amount,
    true,
    task.deployments.pSDLStaking.address,
  ]);

  await sendTransaction(task, "depositor", "deposit(uint256,bool,address)", [
    amount,
    false,
    task.deployments.pSDLStaking.address,
  ]);

  await sendTransaction(task, "depositor", "lockCurve", []);
}

async function verifyDepositLP() {
  const amount = ethers.utils.parseEther("100");

  // await faucetERC20(
  //   task.provider,
  //   deployInfo[network[task.chainId]].saddleD4,
  //   "0x6912a141ad1566f5da7515f522bb756a5a9e85e9",
  //   task.signerAddr,
  //   amount
  // );

  await sendTransaction(task, "saddleD4", "approve", [
    task.deployments.booster.address,
    ethers.constants.MaxUint256,
  ]);

  // console.log(
  //   (
  //     await task.contracts.saddleD4.allowance(
  //       task.signerAddr,
  //       task.deployments.booster.address
  //     )
  //   ).toString()
  // );

  await sendTransaction(task, "booster", "depositAll(uint256,bool)", [0, true]);
}

async function verifyGetReward() {
  await sendTransaction(task, "pSDLStaking", "getReward()", []);
  await sendTransaction(task, "pSDLStaking", "withdrawAll", [false]);
}

async function verifyLPFReward() {
  const amount = ethers.utils.parseEther("100");

  await faucetERC20(
    task.provider,
    deployInfo[network[task.chainId]].LPF,
    "0xa3A7B6F88361F48403514059F1F16C8E78d60EeC",
    task.signerAddr,
    amount
  );

  await sendTransaction(task, "LPF", "approve", [
    task.contracts.LPFStaking.address,
    ethers.constants.MaxUint256,
  ]);

  await sendTransaction(task, "LPFStaking", "stakeAll", []);

  await sendTransaction(task, "LPFStaking", "getReward(bool)", [false]);
}

async function checkIncentive() {
  const earmarkIncentive =
    await task.contracts.booster.callStatic.earmarkRewards(0);

  console.log("earmarkIncentive is:", earmarkIncentive.toString());
}

async function earmark() {
  await sendTransaction(task, "booster", "earmarkRewards", [0]);
}

async function distribute() {
  // await sendTransaction(task, "locker", "addReward", [
  //   task.deployments.DF.address, // _rewardsToken
  //   task.deployments.LPFStakingProxy.address, // _distributor
  //   false, // _useBoost
  // ]);

  await sendTransaction(task, "LPFStakingProxy", "distribute", []);

  // Transfer DF
  const amount = ethers.utils.parseEther("1000");

  await sendTransaction(task, "treasury", "withdrawTo", [
    task.deployments.DF.address,
    amount,
    task.deployments.LPFStakingProxy.address,
  ]);

  // // Distribute by treasury
  // const distributeData =
  //   task.contracts.LPFStakingProxy.interface.encodeFunctionData(
  //     "distributeOther",
  //     [task.contracts.DF.address]
  //   );
  // await sendTransaction(task, "treasury", "execute", [
  //   task.deployments.DF.address,
  //   0,
  //   distributeData,
  // ]);

  // Directly distribute
  // await sendTransaction(task, "LPFStakingProxy", "distributeOther", [
  //   task.deployments.DF.address,
  // ]);
}

async function info() {
  const claimableRewards = await task.contracts.locker.claimableRewards(
    "0xeabc3c69688dda466bcc08065fd0671f3f0b51a2"
  );
  console.log("Lock claimableRewards: ", claimableRewards);

  const extraClaimableRewards =
    await task.contracts.lockerExtraReward.claimableRewards(
      "0xeabc3c69688dda466bcc08065fd0671f3f0b51a2",
      deployInfo[network[task.chainId]].LPF
    );
  console.log("Extra Lock claimableRewards LPF: ", extraClaimableRewards);

  // console.log(
  //   "balanceAtEpochOf:",
  //   await task.contracts.locker.balanceAtEpochOf(
  //     4,
  //     "0xeabc3c69688dda466bcc08065fd0671f3f0b51a2"
  //   )
  // );

  // console.log(
  //   "getNextClaimableIndex:",
  //   await task.contracts.lockerExtraReward.getNextClaimableIndex(
  //     "0xeabc3c69688dda466bcc08065fd0671f3f0b51a2",
  //     deployInfo[network[task.chainId]].LPF
  //   )
  // );

  // console.log(
  //   "claimableRewardsAtEpoch:",
  //   await task.contracts.lockerExtraReward.claimableRewardsAtEpoch(
  //     "0xeabc3c69688dda466bcc08065fd0671f3f0b51a2",
  //     deployInfo[network[task.chainId]].LPF,
  //     4
  //   )
  // );

  // console.log(
  //   "rewardData:",
  //   await task.contracts.lockerExtraReward.rewardData(
  //     deployInfo[network[task.chainId]].LPF,
  //     4
  //   )
  // );
}

async function addLPFRewardForLocker() {
  const amount = ethers.utils.parseEther("1000");

  await faucetERC20(
    task.provider,
    deployInfo[network[task.chainId]].LPF,
    "0xa3A7B6F88361F48403514059F1F16C8E78d60EeC",
    task.signerAddr,
    amount
  );

  // await sendTransaction(task, "LPF", "approve", [
  //   task.contracts.lockerExtraReward.address,
  //   ethers.constants.MaxUint256,
  // ]);

  // await sendTransaction(task, "lockerExtraReward", "addReward", [
  //   deployInfo[network[task.chainId]].LPF,
  //   amount,
  // ]);

  await sendTransaction(task, "lockerExtraReward", "addRewardToEpoch", [
    deployInfo[network[task.chainId]].LPF,
    amount,
    3,
  ]);
}

async function verifyWithdraw() {}

async function listLP() {
  const poolLength = await task.contracts.booster.poolLength();

  for (i = 0; i < poolLength; i++) {
    const poolInfo = await task.contracts.booster.poolInfo(i);

    console.log(`Pool ${i}`);
    console.log(`LP: ${poolInfo[0]}`);
    console.log(`Staking: ${poolInfo[3]}`);
    console.log(`pToken: ${poolInfo[1]}`);
    console.log("\n");
  }
}

async function main() {
  // sendToTenderly("0x60C7067edfc8c0aC22fab6772d37331D943543d3");
  // await faucetETH(task.provider, task.signerAddr);

  // await verifyDepositSDL();

  // await verifyDepositLP();

  // await earmark();

  // await listLP();

  // await verifyGetReward();

  // await verifyLPFReward();

  // await distribute();

  // await addLPFRewardForLocker();

  await info();

  // await checkIncentive();

  // await claimAndLock();
}

run(task, main);
