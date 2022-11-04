export let tenderlyProvider;

export function getTenderlyProvider() {
  return tenderlyProvider
    ? tenderlyProvider
    : new ethers.providers.JsonRpcProvider(
        `https://rpc.tenderly.co/fork/${process.env.TENDERLY_FORK_ID}`
      );
}

export async function faucetETH(provider, to) {
  await provider.send("tenderly_addBalance", [[to], "0x100000000000000"]);
}

export async function faucetERC20(provider, token, from, to, amount) {
  await faucetETH(provider, from);

  const abi = ["function transfer(address to,uint256 amount)"];
  const contract = new ethers.Contract(token, abi, provider);
  const unsignedTx = await contract.populateTransaction.transfer(to, amount);

  await sendTransaction(token, from, unsignedTx.data);
}

export async function sendTransaction(target, from, data) {
  const transactionParameters = [
    {
      to: target,
      from: from,
      data: data,
      gas: ethers.utils.hexValue(3000000),
      gasPrice: ethers.utils.hexValue(1),
      value: ethers.utils.hexValue(0),
    },
  ];

  // The default provider created by hardhat will check `from`
  await getTenderlyProvider().send(
    "eth_sendTransaction",
    transactionParameters
  );
}
