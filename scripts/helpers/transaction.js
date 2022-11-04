import { sendTransaction as sendTransactionTenderly } from "./tenderly";
import { sendTransaction as sendTransactionHardhat } from "./hardhat";

const SEND = 0;
const PRINT = 1;
const PRINT_TENDERLY = 2;
const SEND_TENDERLY = 3;
const SEND_HARDHAT = 4;

let sendOption = SEND_HARDHAT;

let tenderlyID = 0; //process.env.TENDERLY_FORK_ID;
let tenderlyFrom;

export async function sendTransaction(task, target, method, args) {
  console.log(`Going to call ${target}.${method} with args: ${args}`);

  if (sendOption === SEND) {
    const tx = await task.contracts[target][method](...args);

    await tx.wait(2);
  } else {
    const data = await task.contracts[target].populateTransaction[method](
      ...args
    );

    switch (sendOption) {
      case PRINT:
        console.log("Transaction data:", data);
        break;
      case PRINT_TENDERLY:
        printTenderly(data, tenderlyID, tenderlyFrom, task.chainId);
        break;
      case SEND_TENDERLY:
        await sendTransactionTenderly(data.to, tenderlyFrom, data.data);
        break;
      case SEND_HARDHAT:
        await sendTransactionHardhat(data.to, task.signerAddr, data.data);
        break;
    }
  }
}

export function sendTransactionInsteadOfPrint() {
  sendOption = SEND;
}

export function printTransactionInsteadOfSend() {
  sendOption = PRINT;
}

export function printTenderlyInsteadOfSend(from) {
  sendOption = PRINT_TENDERLY;
  tenderlyFrom = from;
}

export function sendToTenderly(from) {
  sendOption = SEND_TENDERLY;
  tenderlyFrom = from;
}

function printTenderly(data, id, from, chainId) {
  const url =
    "\nhttps://dashboard.tenderly.co/SnowJi/project/fork/" +
    id +
    "/simulation/new?parentId=&from=" +
    from +
    "&gas=8000000&gasPrice=0&value=0&contractAddress=" +
    data.to +
    "&rawFunctionInput=" +
    data.data +
    "&network=" +
    chainId +
    "\n";

  console.log(`Tenderly URL: ${url}`);
}

export async function sendTransaction2(contract, target, method, args) {
  console.log(`Going to call ${target}.${method} with args: ${args}`);
  await contract[method](...args);
}
