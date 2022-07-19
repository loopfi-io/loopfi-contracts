import { run } from "./helpers/context";
import {
  sendTransaction,
  printTenderlyInsteadOfSend,
} from "./helpers/transaction";

let task = { name: "Loopfi" };

const network = {
  1: "mainnet",
  42: "kovan",
};

let deployInfo = {
  mainnet: {},
  kovan: {},
};

function isL1() {
  return task.contracts.hasOwnProperty("veDFManager");
}

async function faucetDF(address, amount) {
  await sendTransaction(task, "DF", "transfer", [address, amount]);
  // await sendTransaction(task, "DF", "mint", [address, amount]);
}

async function verifyDeposit() {
  if (isL1()) {
    // Mock some initial deposit
    const amount = ethers.utils.parseEther("10000");
    await sendTransaction(task, "DF", "transfer", [
      task.deployments.depositor.address,
      amount,
    ]);

    await sendTransaction(task, "depositor", "lockDF", []);
  } else {
    const amount = ethers.utils.parseEther("1000");
    // await faucetDF(task.signerAddr, amount.mul(10000));

    await sendTransaction(task, "DF", "approve", [
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
      task.deployments.pDFStaking.address,
    ]);

    // console.log(
    //   (await task.contracts.pDFStaking.balanceOf(task.signerAddr)).toString()
    // );

    await sendTransaction(task, "depositor", "deposit(uint256,bool,address)", [
      amount,
      true,
      task.deployments.pDFStaking.address,
    ]);

    await sendTransaction(task, "depositor", "deposit(uint256,bool,address)", [
      amount,
      false,
      task.deployments.pDFStaking.address,
    ]);

    await sendTransaction(task, "depositor", "lockDF", []);
  }
}

async function verifyGetReward() {
  if (isL1()) {
    const maxGas = 14343621;
    const gasPriceBid = 139328;
    const data =
      "0x0000000000000000000000000000000000000000000000000000000728d1083c00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000";
    const ethVaue = "2029217585532";

    // await sendTransaction(task, "booster", "earmarkRewards", [0]);
    // await sendTransaction(task, "booster", "forwardRewards", [maxGas, gasPriceBid, data]);

    console.log("Going to call booster.earmarkAndForward");
    await task.contracts.booster.earmarkAndForward(maxGas, gasPriceBid, data, {
      value: ethVaue,
    });
  } else {
    // simulate the cross-chain reward
    // await faucetDF(
    //   task.contracts.booster.address,
    //   ethers.utils.parseEther("1000")
    // );

    // await sendTransaction(task, "pDFStaking", "getReward(bool)", [true]);
    await sendTransaction(task, "pDFStaking", "getReward(bool)", [false]);
    await sendTransaction(task, "pDFStaking", "withdrawAll", [false, false]);
  }
}

async function verifyLPFReward() {
  if (task.contracts.hasOwnProperty("lpfStaking")) {
    await sendTransaction(task, "lpf", "approve", [
      task.contracts.lpfStaking.address,
      ethers.constants.MaxUint256,
    ]);
    await sendTransaction(task, "lpfStaking", "stakeAll", []);
    await sendTransaction(task, "lpfStaking", "getReward(bool)", [false]);
  }
}

async function verifyLiquidityMining() {
  if (task.contracts.hasOwnProperty("chef")) {
    // const balance = await task.contracts.lpf.balanceOf(
    //   task.contracts.chef.address
    // );
    // // const balance = await task.contracts.lpf.balanceOf(task.signerAddr);
    // console.log("balance :", balance.toString());

    // const pending = await task.contracts.chef.pendingVel(0, task.signerAddr);
    // console.log("Pending: ", pending.toString());

    const amount = ethers.utils.parseEther("1000");
    await sendTransaction(task, "lpfDFPair", "mint", [task.signerAddr, amount]);
    await sendTransaction(task, "lpfDFPair", "approve", [
      task.contracts.chef.address,
      ethers.constants.MaxUint256,
    ]);
    await sendTransaction(task, "chef", "deposit", [0, amount]);
    await sendTransaction(task, "lpfDFPair", "mint", [task.signerAddr, amount]);
    await sendTransaction(task, "chef", "deposit", [0, amount]);
    await sendTransaction(task, "chef", "claim", [0, task.signerAddr]);
  } else if (task.contracts.hasOwnProperty("rewardDistributor")) {
    const stakingPoolAddresses =
      await task.contracts.rewardDistributor.getAllRecipients();

    console.log("stakingPoolAddresses", stakingPoolAddresses);

    const amount = ethers.utils.parseEther("0.1");

    // mint for mock LP token
    if (task.deployments.hasOwnProperty("pDFDF")) {
      await sendTransaction(task, "pDFDF", "mint", [task.signerAddr, amount]);
    }
    const pDFDFAddress = await task.contracts.pDFDFStaking.uni_lp();

    task.contracts.pDFDF = await ethers.getContractAt("ERC20", pDFDFAddress);

    const balance = await task.contracts.pDFDF.balanceOf(task.signerAddr);

    if (balance.eq(0)) {
      console.error("No pDFDF balance!");
    }

    await sendTransaction(task, "pDFDF", "approve", [
      task.contracts.pDFDFStaking.address,
      ethers.constants.MaxUint256,
    ]);

    await sendTransaction(task, "pDFDFStaking", "stake", [amount]);

    console.log(
      (await task.contracts.pDFDFStaking.earned(task.signerAddr)).toString()
    );

    await sendTransaction(task, "pDFDFStaking", "getReward", []);
  }
}

async function verifyAPY() {
  let apy;

  // L2
  if (!isL1()) {
    const dfRewardRate = await task.contracts.pDFStaking.rewardRate();
    console.log("dfRewardRate is: ", dfRewardRate.toString());
    const dfRewardPerYear = dfRewardRate.mul(365 * 24 * 3600);
    const dfAPY = dfRewardPerYear
      .mul(10000)
      .div(await task.contracts.pDFStaking.totalSupply());

    console.log("DF Apy is:", dfAPY.toString());

    const lpfPrice = ethers.utils.parseEther("0.09986699948251183");
    const dfPrice = ethers.utils.parseEther("0.038659676179898987");
    const lpfRewardRate = await task.contracts.pDFExtraReward.rewardRate();
    console.log("lpfRewardRate is: ", lpfRewardRate.toString());

    const lpfRewardPerYear = lpfRewardRate.mul(365 * 24 * 3600).mul(lpfPrice);
    const lpfAPY = lpfRewardPerYear
      .mul(10000)
      .div((await task.contracts.pDFStaking.totalSupply()).mul(dfPrice));

    console.log("LPF Apy is:", lpfAPY.toString());

    apy = dfAPY.add(lpfAPY);
  }

  console.log("Apy is:", apy.toString());
}

async function checkIncentive() {
  if (isL1()) {
    // Depositor
    const lockIncentive = await task.contracts.depositor.callStatic.lockDF();
    console.log("lockDFIncentive is:", lockIncentive.toString());

    const lockData = task.contracts.depositor.interface.encodeFunctionData(
      "lockDF",
      []
    );
    const res = await task.contracts.depositor.callStatic.multicall([lockData]);
    const incentive = ethers.BigNumber.from(res[res.length - 1]);
    console.log("lockDFIncentive is:", incentive.toString());

    // Booster
    const maxGas = 14343621;
    const gasPriceBid = 139328;
    const data =
      "0x0000000000000000000000000000000000000000000000000000000728d1083c00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000";
    const ethVaue = "2029217585532";

    const forwardIncentive =
      await task.contracts.booster.callStatic.forwardRewards(
        maxGas,
        gasPriceBid,
        data,
        { value: ethVaue }
      );
    console.log("forwardIncentive is:", forwardIncentive.toString());

    const earmarkAndForwardIncentive =
      await task.contracts.booster.callStatic.earmarkAndForward(
        maxGas,
        gasPriceBid,
        data,
        { value: ethVaue }
      );
    console.log(
      "earmarkAndForwardIncentive is:",
      earmarkAndForwardIncentive.toString()
    );
  }
  // const earmarkIncentive =
  //   await task.contracts.pDFStaking.callStatic.earmarkRewards();

  // console.log("earmarkTotalIncentive is:", earmarkIncentive.toString());

  // if (task.contracts.hasOwnProperty("depositProxyL2")) {
  //   const crossIncentive =
  //     await task.contracts.depositProxyL2.callStatic.getReward();

  //   console.log("crossIncentive is:", crossIncentive.toString());
  // }

  if (task.contracts.hasOwnProperty("booster")) {
    const earmarkIncentive =
      await task.contracts.booster.callStatic.earmarkRewards(0);

    console.log("earmarkIncentive is:", earmarkIncentive.toString());
  }
}

async function claimAndLock() {
  const data = "0x";

  const [claimData] = task.contracts.depositor.interface.decodeFunctionData(
    "multicall",
    data
  );

  console.log(claimData);

  const lockData = task.contracts.depositor.interface.encodeFunctionData(
    "lockDF",
    []
  );

  const claimAndLockData =
    task.contracts.depositor.interface.encodeFunctionData("multicall", [
      claimData[0],
      lockData,
    ]);
  claimAndLockData.push(lockData);

  console.log(claimAndLockData);

  await task.contracts.depositor.multicall([...claimData, lockData]);
}

async function releaseDF() {
  const unlockData = task.contracts.depositor.interface.encodeFunctionData(
    "unlockDF",
    []
  );
  const approveXData = task.contracts.voter.interface.encodeFunctionData(
    "approveX",
    [
      [task.deployments.DF.address],
      [task.deployments.treasury.address],
      [ethers.constants.MaxUint256],
    ]
  );
  const transferFromData = task.contracts.DF.interface.encodeFunctionData(
    "transferFrom",
    [
      task.deployments.voter.address,
      task.deployments.treasury.address,
      ethers.utils.parseEther("10"),
    ]
  );
  const executeData = task.contracts.treasury.interface.encodeFunctionData(
    "execute",
    [task.deployments.DF.address, 0, transferFromData]
  );

  console.log(unlockData);
  console.log(approveXData);
  console.log(executeData);
}

async function main() {
  // printTenderlyInsteadOfSend(
  //   "87dae1cb-0ee2-4ad4-9b98-f7cd1aa0d880",
  //   "0x16dd90836680631985351d80f8addf83a31d5eae"
  // );

  // await verifyDeposit();
  // await verifyAPY();
  // await verifyGetReward();

  // await verifyLiquidityMining();

  // await checkIncentive();

  await releaseDF();
}

run(task, main);
