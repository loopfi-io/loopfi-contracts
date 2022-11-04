export function getInitializerData(ImplFactory, args, initializer) {
  if (initializer === false) {
    return "0x";
  }

  const allowNoInitialization = initializer === undefined && args.length === 0;
  initializer = initializer ?? "initialize";

  try {
    if (ethers.version[0] == 4)
      return ImplFactory.interface.functions[initializer].encode(args);

    const fragment = ImplFactory.interface.getFunction(initializer);
    return ImplFactory.interface.encodeFunctionData(fragment, args);
  } catch (e) {
    if (e instanceof Error) {
      if (allowNoInitialization && e.message.includes("no matching function")) {
        return "0x";
      }
    }
    throw e;
  }
}

async function getArtifactsByName(name, path) {
  let [contractName, contractFile] = name.split("@");
  if (contractFile === undefined) {
    contractFile = contractName;
  }
  const contractPath = `browser/artifacts/${path}/${contractFile}.sol/${contractName}.json`;

  console.log(contractPath);

  // Use the hardhat artifact
  const artifacts = JSON.parse(
    await remix.call("fileManager", "getFile", contractPath)
  );

  return artifacts;
}

async function getContractFactoryByName(name, path = "contracts/") {
  // Hardhat has this helper function
  if (typeof remix !== "object") {
    return ethers.getContractFactory(name.split("@")[0]);
  }

  const artifacts = await getArtifactsByName(name, path);

  return new ethers.ContractFactory(artifacts.abi, artifacts.bytecode);
}

export async function deployContractInternal(signer, contract, path, args) {
  const Contract = await getContractFactoryByName(contract, path);

  const deploy = await Contract.connect(signer).deploy(...args);
  await deploy.deployed();

  console.log(`${contract} deployed at ${deploy.address}`);

  return deploy;
}

export async function deployProxy(
  signer,
  contract,
  path,
  adminAddress,
  implAddress,
  args,
  initializer
) {
  const contractFactory = await getContractFactoryByName(contract, path);
  const data = getInitializerData(contractFactory, args, initializer);

  const proxy = await deployContractInternal(
    signer,
    "TransparentUpgradeableProxy",
    "@openzeppelin/contracts/proxy/",
    [implAddress, adminAddress, data]
  );

  //   console.log(proxy.address);
  return proxy;
}

export async function attachContractAtAdddress(
  signer,
  address,
  name,
  path = "contracts/"
) {
  // Hardhat has this helper function
  if (typeof remix !== "object") {
    return await ethers.getContractAt(name.split("@")[0], address);
  }

  const artifacts = await getArtifactsByName(name, path);

  return new ethers.Contract(address, artifacts.abi, signer);
}

export function getTransactionData(contract, method, args) {
  if (ethers.version[0] == 4)
    return contract.interface.functions[method].encode(args);

  const fragment = contract.interface.getFunction(method);
  return contract.interface.encodeFunctionData(fragment, args);
}

export function printParam(transactions, title = "send transaction!") {
  console.log(`\n--------${title}--------\n`);
  for (const [contract, method, args] of transactions) {
    // for (let index = 0; index < transactions.length; index++) {
    let data = getTransactionData(contract, method, args);
    console.log(`to:      ${contract.address}`);
    console.log(`method:  ${method}`);
    console.log(`args:    ${args}`);
    console.log(`data:    ${data}\n`);
  }
}
