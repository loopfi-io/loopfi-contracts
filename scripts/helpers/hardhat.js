export let hardhatProvider;

// url = "http://127.0.0.1:8545/";
url = "https://rpc.dforce.network/9007/";
// url = "http://v3.667899.xyz:9007/"

export function getHardhatProvider() {
  return hardhatProvider
    ? hardhatProvider
    : new ethers.providers.JsonRpcProvider(url);
}

export async function sendTransaction(target, from, data) {
  const provider = getHardhatProvider();
  await provider.send("hardhat_impersonateAccount", [from]);

  const transactionParameters = [
    {
      to: target,
      from: from,
      data: data,
      gas: ethers.utils.hexValue(30_000_000),
      gasPrice: ethers.utils.hexValue(3000_000_000),
      value: ethers.utils.hexValue(0),
    },
  ];

  // The default provider created by hardhat will check `from`
  await provider.send("eth_sendTransaction", transactionParameters);

  await provider.send("hardhat_stopImpersonatingAccount", [from]);
}

export async function faucetETH(provider, address) {
  await getHardhatProvider().send("hardhat_setBalance", [
    address,
    "0x100000000000000000",
  ]);

  console.log(
    "ETH balance of ",
    address,
    " : ",
    ethers.utils.formatEther(await provider.getBalance(address))
  );
}

export async function faucetERC20(provider, token, from, to, amount) {
  await faucetETH(provider, from);

  const abi = [
    "function transfer(address to,uint256 amount)",
    "function symbol() public view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)",
  ];
  const contract = new ethers.Contract(token, abi, provider);
  const unsignedTx = await contract.populateTransaction.transfer(to, amount);

  await sendTransaction(token, from, unsignedTx.data);

  console.log(
    await contract.symbol(),
    "balance of ",
    to,
    " : ",
    ethers.utils.formatUnits(
      await contract.balanceOf(to),
      await contract.decimals()
    )
  );
}
