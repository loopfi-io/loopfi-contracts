import {
  deployContractInternal,
  deployProxy,
  attachContractAtAdddress,
} from "./contract";

function checkArgs(args) {
  if (args.includes(undefined)) {
    throw "Some argument is undefined";
  }
}

export async function deployContract(
  contracts,
  deployments,
  signer,
  proxyAdmin,
  name,
  { contract, path, useProxy, getArgs, initializer, constructWithArgs = true }
) {
  if (deployments.hasOwnProperty(name)) {
    console.log(name, "Already deployed");
    return;
  }

  console.log("\n------------------------------------");
  console.log(`Going to deploy ${name}`);

  const args = getArgs(deployments);

  checkArgs(args);

  // console.log("args:", args);s

  let contractInstance;
  if (useProxy) {
    const implementation = contract + "Impl";

    let finalProxyAdmin;
    if (proxyAdmin) {
      finalProxyAdmin = proxyAdmin;
    } else {
      finalProxyAdmin = deployments["proxyAdmin"].address;
    }

    if (!finalProxyAdmin) {
      throw "Proxy admin is not defined";
    }

    // Implementation has not been deployed yet, deploy it first
    if (!deployments[implementation]) {
      console.log(`Going to deploy ${implementation}`);

      let implementationInstance;
      if (constructWithArgs) {
        implementationInstance = await deployContractInternal(
          signer,
          contract,
          path,
          args
        );
      } else {
        implementationInstance = await deployContractInternal(
          signer,
          contract,
          path,
          []
        );

        console.log(`Going to initialize ${implementation}`);
        await implementationInstance.initialize(...args);
      }

      console.log(
        `${implementation} deployed at ${implementationInstance.address}`
      );
      deployments[implementation] = {
        contract: contract,
        path: path,
        address: implementationInstance.address,
      };
    }

    console.log(`Going to deploy the ${name} proxy`);

    const proxy = await deployProxy(
      signer,
      contract,
      path,
      finalProxyAdmin,
      deployments[implementation].address,
      args,
      initializer
    );

    contractInstance = await attachContractAtAdddress(
      signer,
      proxy.address,
      contract,
      path
    );
  } else {
    contractInstance = await deployContractInternal(
      signer,
      contract,
      path,
      args
    );
  }

  console.log(`${name} deployed at ${contractInstance.address}`);

  contracts[name] = contractInstance;
  deployments[name] = {
    contract: contract,
    path: path,
    address: contractInstance.address,
  };
}

export async function deployContracts(task) {
  for (const [key, config] of Object.entries(task.contractsToDeploy)) {
    await deployContract(
      task.contracts,
      task.deployments,
      task.signer,
      task.proxyAdmin,
      key,
      config
    );
  }
}
