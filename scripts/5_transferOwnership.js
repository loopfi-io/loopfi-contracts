import { run } from "./helpers/context";
import { deployContracts } from "./helpers/deploy";
import { sendTransaction, sendToTenderly } from "./helpers/transaction";
import { attachContractAtAdddress } from "./helpers/contract";

const task = { name: "Loopfi" };

const network = {
  1: "mainnet",
  5: "goerli",
  42: "kovan",
  69: "OpTest",
  42161: "arbitrum",
};

async function transferOwnership(pendingOwner) {
  const contractsToTransfer = task.contracts;
  // const contractsToTransfer = {"voter":task.contracts.voter, "treasury":task.contracts.treasury, "depositor":task.contracts.depositor};

  for (const [key, contract] of Object.entries(contractsToTransfer)) {
    console.log(key);

    if (
      contract.hasOwnProperty("_setPendingOwner") &&
      (await contract.owner()) === task.signerAddr
    ) {
      await sendTransaction(task, key, "_setPendingOwner", [pendingOwner]);
    }
  }
}

async function main() {
  await transferOwnership("0x22771Db43658128f6af2485572575Ed708a13a87");
}

run(task, main);
