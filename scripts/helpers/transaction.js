const SEND = 0;
const PRINT = 1;
const PRINT_TENDERLY = 2;

let sendOption = 0;

let tenderlyID, tenderlyFrom;

export async function sendTransaction(task, target, method, args) {
  console.log(`Going to call ${target}.${method} with args: ${args}`);

  if (sendOption === SEND) {
    const tx = await task.contracts[target][method](...args);

    await tx.wait(2);
  } else {
    const data = await task.contracts[target].populateTransaction[method](
      ...args
    );

    if (sendOption === PRINT) {
      console.log(`Transaction data:`, data);
    } else {
      printTenderly(data, tenderlyID, tenderlyFrom, task.chainId);
    }
  }
}

export function sendTransactionInsteadOfPrint() {
  sendOption = SEND;
}

export function printTransactionInsteadOfSend() {
  sendOption = PRINT;
}

export function printTenderlyInsteadOfSend(id, from) {
  sendOption = PRINT_TENDERLY;

  tenderlyID = id;
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
