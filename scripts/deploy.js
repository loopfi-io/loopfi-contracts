async function getSigner() {
  return new ethers.providers.Web3Provider(web3Provider).getSigner();
}

async function initializeContract(contractAddress, artifactsPath) {
  const signer = await getSigner();
  const metadata = await getMetaData(artifactsPath);
  return new ethers.Contract(contractAddress, metadata.abi, signer);
}

async function getMetaData(artifactsPath) {
  return JSON.parse(await remix.call("fileManager", "getFile", artifactsPath));
}

async function deployContrats(contractName, constructorArgs, artifactsPath) {
  // 'web3Provider' is a remix global variable object
  const signer = await getSigner();
  // console.log("Current account address is: ", await signer.getAddress());

  const metadata = await getMetaData(artifactsPath);

  const factory = new ethers.ContractFactory(
    metadata.abi,
    metadata.bytecode,
    signer
  );

  console.log("Going to deploy: ", contractName);
  const contract = await factory.deploy(...constructorArgs);
  // The contract is NOT deployed yet; we must wait until it is mined
  console.log(contractName, " contract address is: ", contract.address, "\n");
  await contract.deployed();

  return contract;
}

// Right click on the script name and hit "Run" to execute
(async () => {
  console.log("Running deployWithEthers script...");

  const signer = await getSigner();
  console.log("Current account address is: ", await signer.getAddress());

  // TODO: configs:
  // Premine
  const perminedAmount = ethers.utils.parseEther("1000000"); // 1,000,000
  // Kovan:
  let dfAddress = "0x06146373f4Bddd186Ccb4B549781b97A18802bae";
  let veDFEscrowAddress = "0x65a47CC537A478c9215Da90A5E0B423f06A0078e";
  let voterAddress = "0xB1d343863bdBD6a185aDF2A7e275e9B2C31C81EB";
  let veloAddress = "0xf89201981cE799093b2Cb8f03E30736d09f937FD";
  let boosterAddress = "0xd8fAD440125522c004DBD2F78c1422d367dAB589";
  let rewardFactoryAddress = "0xB2C0F4269d32F9Eb7a255E73983823F27b858C08";
  let velDFTokenAddress = "0xd2B670c829885F8eC4ec78Ef46E5516b18fB606f";
  let depositorAddress = "0x970786ebA8616729d05DfCB21461394bEe5d1cFc";
  let baseRewardPoolAddress = "0xA3D4790398025D3Dff7DBaC76621d65a89F06916";

  // 1. Deploy underlying (DF) contract.
  let df;

  const contractName = "ERC20Mock"; // Change this for other contract
  const constructorArgs = ["DF Mock Token", "DFM"]; // Put constructor args (if any) here for your contract

  // Note that the script needs the ABI which is generated from the compilation artifact.
  // Make sure contract is compiled and artifacts are generated
  const artifactsPath = `browser/artifacts/contracts/mock/${contractName}.sol/${contractName}.json`; // Change this for different path
  if (!dfAddress) {
    df = await deployContrats(contractName, constructorArgs, artifactsPath);
    dfAddress = df.address;
  } else {
    df = await initializeContract(dfAddress, artifactsPath);
  }

  console.log("df contract address is: ", df.address);

  // 2. Deploy veDF escrow contract.
  let veDFEscrow;

  const veDFManagerMockContractName = "veDFManagerMock";
  const veDFManagerMockConstructorArgs = [dfAddress];

  const veDFManagerMockArtifactsPath = `browser/artifacts/contracts/mock/${veDFManagerMockContractName}.sol/${veDFManagerMockContractName}.json`; // Change this for different path
  if (!veDFEscrowAddress) {
    veDFEscrow = await deployContrats(
      veDFManagerMockContractName,
      veDFManagerMockConstructorArgs,
      veDFManagerMockArtifactsPath
    );
    veDFEscrowAddress = veDFEscrow.addresss;
  } else {
    veDFEscrow = await initializeContract(
      veDFEscrowAddress,
      veDFManagerMockArtifactsPath
    );
  }

  // 3. Deploy voter proxy contract.
  let voter;

  const voterProxyContractName = "DFVoterProxy";
  const voterProxyConstructorArgs = [
    dfAddress, // _df
    veDFEscrowAddress, // _mintr
    veDFEscrowAddress, // _escrow
    dfAddress, // _gaugeController
  ];

  const voterProxyArtifactsPath = `browser/artifacts/contracts/${voterProxyContractName}.sol/${voterProxyContractName}.json`; // Change this for different path
  if (!voterAddress) {
    voter = await deployContrats(
      voterProxyContractName,
      voterProxyConstructorArgs,
      voterProxyArtifactsPath
    );
    voterAddress = voter.address;
  } else {
    voter = await initializeContract(voterAddress, voterProxyArtifactsPath);
  }

  // 4. Deploy velo token.
  let velo;

  const veloContractName = "VeloToken";
  const veloConstructorArgs = [voterAddress];

  const veloArtifactsPath = `browser/artifacts/contracts/${veloContractName}.sol/${veloContractName}.json`; // Change this for different path
  if (!veloAddress) {
    velo = await deployContrats(
      veloContractName,
      veloConstructorArgs,
      veloArtifactsPath
    );
    veloAddress = velo.address;

    if (perminedAmount.toString() !== "0") {
      await velo.mint(await signer.getAddress(), perminedAmount);
    }
  } else {
    velo = await initializeContract(veloAddress, veloArtifactsPath);
  }

  // 5. Deploy booster contract
  let booster;

  const boosterContractName = "Booster";
  const boosterConstructorArgs = [dfAddress, voterAddress, veloAddress];

  const boosterArtifactsPath = `browser/artifacts/contracts/${boosterContractName}.sol/${boosterContractName}.json`; // Change this for different path
  if (!boosterAddress) {
    booster = await deployContrats(
      boosterContractName,
      boosterConstructorArgs,
      boosterArtifactsPath
    );
    boosterAddress = booster.address;

    // Set booster as operator in VoterProxy
    await voter.setOperator(booster.address);
  } else {
    booster = await initializeContract(boosterAddress, boosterArtifactsPath);
  }

  // 6. Deploy reward factory contract
  let rewardFactory;

  const rewardFactoryContractName = "RewardFactory";
  const rewardFactoryConstructorArgs = [df.address, booster.address];
  const rewardFactoryArtifactsPath = `browser/artifacts/contracts/${rewardFactoryContractName}.sol/${rewardFactoryContractName}.json`; // Change this for different path
  if (!rewardFactoryAddress) {
    rewardFactory = await deployContrats(
      rewardFactoryContractName,
      rewardFactoryConstructorArgs,
      rewardFactoryArtifactsPath
    );
    rewardFactoryAddress = rewardFactory.address;
  } else {
    rewardFactory = await initializeContract(
      rewardFactoryAddress,
      rewardFactoryArtifactsPath
    );
  }

  // 7. Deploy vel df token
  let velDFToken;

  const velDFTokenContractName = "velDFToken";
  const velDFTokenConstructorArgs = [];
  const velDFTokenArtifactsPath = `browser/artifacts/contracts/${velDFTokenContractName}.sol/${velDFTokenContractName}.json`; // Change this for different path
  if (!velDFTokenAddress) {
    velDFToken = await deployContrats(
      velDFTokenContractName,
      velDFTokenConstructorArgs,
      velDFTokenArtifactsPath
    );
    velDFTokenAddress = velDFToken.address;
  } else {
    velDFToken = await initializeContract(
      velDFTokenAddress,
      velDFTokenArtifactsPath
    );
  }

  // 8. Deploy df depositor
  let depositor;

  const depositorContractName = "DFDepositor";
  const depositorConstructorArgs = [
    df.address, // _df
    veDFEscrow.address, // _escrow
    voter.address, // _staker
    velDFToken.address, // _minter
  ];
  const depositorArtifactsPath = `browser/artifacts/contracts/${depositorContractName}.sol/${depositorContractName}.json`; // Change this for different path
  if (!depositorAddress) {
    depositor = await deployContrats(
      depositorContractName,
      depositorConstructorArgs,
      depositorArtifactsPath
    );
    depositorAddress = depositor.address;

    // Set operator in velDFToken contract.
    await velDFToken.setOperator(depositor.address);
    // Set depositor in df voter proxy.
    await voter.setDepositor(depositor.address);
    // Init lock in depositor contract.
    await depositor.initialLock();
    // Set treasury address in booster contract
    await booster.setTreasury(depositor.address);
  } else {
    depositor = await initializeContract(
      depositorAddress,
      depositorArtifactsPath
    );
  }

  // 9. Deploy base reward pool contract
  let baseRewardPool;

  const baseRewardPoolContractName = "BaseRewardPool";
  const baseRewardPoolConstructorArgs = [
    0, // pid_
    velDFToken.address, // stakingToken_
    df.address, // rewardToken_
    booster.address, // operator_
    rewardFactory.address, // rewardManager_
  ];
  const baseRewardPoolArtifactsPath = `browser/artifacts/contracts/${baseRewardPoolContractName}.sol/${baseRewardPoolContractName}.json`; // Change this for different path
  if (!baseRewardPoolAddress) {
    baseRewardPool = await deployContrats(
      baseRewardPoolContractName,
      baseRewardPoolConstructorArgs,
      baseRewardPoolArtifactsPath
    );
    baseRewardPoolAddress = baseRewardPool.address;

    // Set reward addresses in booster contract
    // TODO: the second parameter should be actual velReward contract address
    await booster.setRewardContracts(
      baseRewardPool.address,
      baseRewardPool.address
    );
  } else {
    baseRewardPool = await initializeContract(
      baseRewardPoolAddress,
      baseRewardPoolArtifactsPath
    );
  }

  console.log("Deployment successful.");
})();
