import { run } from "./helpers/context";
import { deployContracts } from "./helpers/deploy";
import { faucetERC20 } from "./helpers/tenderly";
import {
  sendTransaction,
  sendTransactionInsteadOfPrint,
  sendToTenderly,
} from "./helpers/transaction";

const task = { name: "Loopfi_Saddle" };

const network = {
  1: "mainnet",
};

const deployInfo = {
  mainnet: {
    SDL: "0xf1Dc500FdE233A4055e25e5BbF516372BC4F6871",
    veSDL: "0xD2751CdBED54B87777E805be36670D7aeAe73bb2",
    LPF: "0x3650B69f86cB593f116e276C30666834336c0647",
    TREASURY: "0x2E3499Db9bFC793924083B2d771CfC19863ca62C",
  },
};

async function deploy() {
  const info = deployInfo[network[task.chainId]];

  task.contractsToDeploy = {
    pSDL: {
      contract: "pSDL",
      path: "contracts/saddle/",
      useProxy: false,
      getArgs: () => [],
    },
    voter: {
      contract: "SdlVoterProxy",
      path: "contracts/saddle/",
      useProxy: false,
      getArgs: () => [],
    },
    depositor: {
      contract: "SdlDepositor",
      path: "contracts/saddle/",
      useProxy: false,
      getArgs: (deployments) => [
        deployments.voter.address,
        deployments.pSDL.address,
      ],
    },
    booster: {
      contract: "SdlBooster",
      path: "contracts/saddle/",
      useProxy: false,
      getArgs: (deployments) => [deployments.voter.address, info.LPF],
    },
    pSDLStaking: {
      contract: "SdlBaseRewardPool",
      path: "contracts/saddle/",
      useProxy: false,
      getArgs: (deployments) => [
        0, // pid_
        deployments.pSDL.address, // stakingToken_
        info.SDL, // rewardToken_
        deployments.booster.address, // operator_
        task.signerAddr, // rewardManager
      ],
    },
    pSDLExtraReward: {
      contract: "VirtualBalanceRewardPool",
      useProxy: false,
      getArgs: (deployments) => [
        deployments.pSDLStaking.address, // deposit_
        info.LPF, // rewardToken_
      ],
    },
    proxyFactory: {
      contract: "ProxyFactory",
      path: "contracts/saddle/",
      useProxy: false,
      getArgs: () => [],
    },
    tokenFactory: {
      contract: "TokenFactory",
      path: "contracts/saddle/",
      useProxy: false,
      getArgs: (deployments) => [deployments.booster.address],
    },
    rewardFactory: {
      contract: "RewardFactory",
      path: "contracts/saddle/",
      useProxy: false,
      getArgs: (deployments) => [deployments.booster.address],
    },
    stashFactory: {
      contract: "StashFactoryV2",
      path: "contracts/saddle/",
      useProxy: false,
      getArgs: (deployments) => [
        deployments.booster.address,
        deployments.rewardFactory.address,
        deployments.proxyFactory.address,
      ],
    },
    // stashRewardV1: {
    //   contract: "ExtraRewardStashV1",
    //   path: "contracts/saddle/",
    //   useProxy: false,
    //   getArgs: () => [],
    // },
    // stashRewardV2: {
    //   contract: "ExtraRewardStashV2",
    //   path: "contracts/saddle/",
    //   useProxy: false,
    //   getArgs: () => [],
    // },
    stashRewardV3: {
      contract: "ExtraRewardStashV3",
      path: "contracts/saddle/",
      useProxy: false,
      getArgs: () => [],
    },
    LPFStaking: {
      contract: "LPFRewardPool",
      useProxy: false,
      getArgs: (deployments) => [
        info.LPF, // stakingToken_
        info.SDL, // rewardToken_
        deployments.depositor.address, // crvDeposits_
        deployments.pSDLStaking.address, // cvxCrvRewards_
        deployments.pSDL.address, // cvxCrvToken_
        deployments.booster.address, // operator_
        task.signerAddr, // rewardManager
      ],
    },
    // LPFExtraReward: {
    //   contract: "VirtualBalanceRewardPool",
    //   useProxy: false,
    //   getArgs: (deployments) => [
    //     deployments.LPFStaking.address, // deposit_
    //     info.LPF, // rewardToken_
    //   ],
    // },
    locker: {
      contract: "LpfLocker",
      useProxy: false,
      getArgs: (deployments) => [
        info.LPF, // _stakingToken
        deployments.pSDL.address, // _cvxCrv
        deployments.pSDLStaking.address, // _cvxcrvStaking
      ],
    },
    lockerExtraReward: {
      contract: "vlCvxExtraRewardDistribution",
      useProxy: false,
      getArgs: (deployments) => [
        deployments.locker.address, // _locker
      ],
    },
    LPFStakingProxy: {
      contract: "LpfStakingProxy",
      useProxy: false,
      getArgs: (deployments) => [
        deployments.locker.address, // _rewards
        info.SDL, // _crv
        info.LPF, // _cvx
        deployments.pSDL.address, // _cvxCrv
        deployments.LPFStaking.address, // _cvxStaking
        deployments.pSDLStaking.address, // _cvxCrvStaking
        deployments.depositor.address, // _crvDeposit
      ],
    },
  };

  await deployContracts(task);
}

async function config() {
  const info = deployInfo[network[task.chainId]];

  // await sendTransaction(task, "pSDL", "setOperator", [
  //   task.deployments.depositor.address,
  // ]);

  // await sendTransaction(task, "voter", "setOperator", [
  //   task.deployments.booster.address,
  // ]);
  // await sendTransaction(task, "voter", "setDepositor", [
  //   task.deployments.depositor.address,
  // ]);

  // await sendTransaction(task, "stashFactory", "setImplementation", [
  //   ethers.constants.AddressZero, // v1
  //   ethers.constants.AddressZero, // v2
  //   task.deployments.stashRewardV3.address, //v3
  // ]);

  // await sendTransaction(task, "booster", "setFactories", [
  //   task.deployments.rewardFactory.address,
  //   task.deployments.stashFactory.address,
  //   task.deployments.tokenFactory.address,
  // ]);
  // await sendTransaction(task, "booster", "setRewardContracts", [
  //   task.deployments.pSDLStaking.address,
  //   task.deployments.LPFStaking.address,
  // ]);

  // await sendTransaction(task, "pSDLStaking", "addExtraReward", [
  //   task.deployments.pSDLExtraReward.address,
  // ]);

  // await sendTransaction(task, "LPFStakingProxy", "setApprovals", []);

  // await sendTransaction(task, "locker", "setStakingContract", [
  //   task.deployments.LPFStakingProxy.address,
  // ]);

  await sendTransaction(task, "locker", "addReward", [
    task.deployments.pSDL.address, // _rewardsToken
    task.deployments.LPFStakingProxy.address, // _distributor
    false, // _useBoost
  ]);

  await sendTransaction(task, "locker", "setApprovals", []);
  await sendTransaction(task, "locker", "setBoost", [
    1000,
    10000,
    info.TREASURY,
  ]);
}

async function addWhiteList(checkerAddress, wallet) {
  const abi = [
    "function owner() view returns (address)",
    "function approveWallet(address wallet)",
  ];

  task.contracts.checker = new ethers.Contract(
    checkerAddress,
    abi,
    ethers.provider
  );
  const owner = await task.contracts.checker.owner();

  sendToTenderly(owner);
  await sendTransaction(task, "checker", "approveWallet", [wallet]);
  sendToTenderly(task.signerAddr);
}

async function initialLock() {
  // Add voter to Saddle' whitelist
  await addWhiteList(
    "0x4C6A2bE3D64048a0624568F91720a8f3884eBfd8",
    task.deployments.voter.address
  );

  await faucetERC20(
    task.provider,
    deployInfo[network[task.chainId]].SDL,
    "0xcb8efb0c065071e4110932858a84365a80c8fef0", // from
    task.deployments.voter.address,
    ethers.utils.parseEther("100")
  );

  await sendTransaction(task, "depositor", "initialLock", []);
}

async function addRewardForLocker() {
  await sendTransaction(task, "locker", "addReward", [
    task.deployments.DF.address, // _rewardsToken
    task.deployments.LPFStakingProxy.address, // _distributor
    false, // _useBoost
  ]);
}

async function notifyRewardForLocker() {
  const amount = ethers.utils.parseEther("1000");

  await sendTransaction(task, "treasury", "withdrawTo", [
    task.deployments.DF.address,
    amount,
    task.deployments.LPFStakingProxy.address,
  ]);

  await sendTransaction(task, "LPFStakingProxy", "distributeOther", [
    task.deployments.DF.address,
  ]);
}

async function queueLPFExtraReward() {
  const reward = ethers.utils.parseEther("20000000");

  await faucetERC20(
    task.provider,
    deployInfo[network[task.chainId]].LPF,
    "0xa3A7B6F88361F48403514059F1F16C8E78d60EeC", // from
    task.signerAddr,
    reward
  );

  await sendTransaction(task, "LPF", "transfer", [
    task.deployments.pSDLExtraReward.address,
    reward,
  ]);

  await sendTransaction(task, "pSDLExtraReward", "queueNewRewards", [reward]);
}

async function addLPPool() {
  const lpInfo = {
    // saddleUSDV2: {
    //   token: "0x5f86558387293b6009d7896A61fcc86C17808D62",
    //   gauge: "0x7B2025Bf8c5ee8Baad9da8C3E3Ee45E96ed8b8EA",
    //   stashVersion: 3,
    // },
    // FRAX_3pool: {
    //   token: "0x0785aDDf5F7334aDB7ec40cD785EBF39bfD91520",
    //   gauge: "0x13Ba45c2B686c6db7C2E28BD3a9E8EDd24B894eD",
    //   stashVersion: 3,
    // },
    // FRAX_alUSD: {
    //   token: "0x3cF7b9479a01eeB3bbfC43581fa3bb21cd888e2A",
    //   gauge: "0x953693DCB2E9DDC0c1398C1b540b81b63ceA5e16",
    //   stashVersion: 3,
    // },
    // FRAX_sUSD: {
    //   token: "0x6Ac7a4cB3BFa90DC651CD53EB098e23c88d04e77",
    //   gauge: "0x104F44551386d603217450822443456229F73aE4",
    //   stashVersion: 3,
    // },
    // FRAX_USDC: {
    //   token: "0x927E6f04609A45B107C789aF34BA90Ebbf479f7f",
    //   gauge: "0xB2Ac3382dA625eb41Fc803b57743f941a484e2a6",
    //   stashVersion: 3,
    // },
    // FRAX_USDT: {
    //   token: "0x486DFCfdbF9025c062110E8c0344a15279aD0a85",
    //   gauge: "0x6EC5DD7D8E396973588f0dEFD79dCA04F844d57C",
    //   stashVersion: 3,
    // },
    // FRAX_USX: {
    //   token: "0xAaD59B28CC76eD4c9F7C83E697E5cC925fB0B920",
    //   gauge: "0x9585a54297beAa83F044866678b13d388D0180bf",
    //   stashVersion: 3,
    // },
    // saddleD4: {
    //   token: "0xd48cF4D7FB0824CC8bAe055dF3092584d0a1726A",
    //   gauge: "0x702c1b8Ec3A77009D5898e18DA8F8959B6dF2093",
    //   stashVersion: 3,
    // },
    USDC_USX: {
      token: "0x1AE28a6ACA177c29b5773e91fbf74AfB0B7fE5C9",
      gauge: "0x50d745c2a2918A47A363A2d32becd6BBC1A53ece",
      stashVersion: 3,
    },
  };

  for (let lp in lpInfo) {
    let lpDetails = lpInfo[lp];

    await sendTransaction(task, "booster", "addPool", [
      lpDetails.token,
      lpDetails.gauge,
      lpDetails.stashVersion,
    ]);
  }
}

async function main() {
  sendToTenderly(task.signerAddr);

  //   await faucetETH(task.provider, task.signerAddr);

  //   await faucetERC20(
  //     task.provider,
  //     deployInfo[network[task.chainId]].LPF,
  //     "0xa3A7B6F88361F48403514059F1F16C8E78d60EeC",
  //     task.signerAddr,
  //     ethers.utils.parseEther("100")
  //   );

  await deploy();

  // await config();

  // await initialLock();

  // await addLPPool();

  // await queueLPFExtraReward();
}

run(task, main);
