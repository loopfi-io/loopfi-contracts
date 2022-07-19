export function getProvider() {
  let provider;
  if (typeof remix === "object") {
    provider = new ethers.providers.Web3Provider(web3Provider);
  } else {
    provider = ethers.provider;
  }

  return provider;
}

export async function loadJSON(file) {
  let json;

  try {
    if (typeof remix === "object") {
      json = await remix.call("fileManager", "getFile", file);
    } else {
      json = require("fs").readFileSync(file);
    }
  } catch (e) {
    console.log(`${file} open failed`);
    json = "{}";
  }

  return JSON.parse(json);
}

export async function saveJSON(file, json) {
  try {
    if (typeof remix === "object") {
      await remix.call(
        "fileManager",
        "writeFile",
        file,
        JSON.stringify(json, null, 2)
      );
    } else {
      const fs = require("fs");
      if (!fs.existsSync(file)) {
        const path = require("path");
        fs.mkdirSync(path.dirname(file), { recursive: true });
      }
      fs.writeFileSync(file, JSON.stringify(json, null, 2));
    }

    console.log(`${file} saved`);
  } catch (e) {
    console.log(`Save ${file} failed`, e);
  }
}

export async function getNextDeployAddress(signer) {
  const from = await signer.getAddress();
  const nonce = (await signer.getTransactionCount()) + 1;
  // console.log('Deployer next nonce is: ', nonce)
  const addressOfNextDeployedContract = ethers.utils.getContractAddress({
    from,
    nonce,
  });
  // console.log('Next deploy contract address is: ', addressOfNextDeployedContract)

  return addressOfNextDeployedContract;
}
