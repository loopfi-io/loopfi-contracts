const hre = require("hardhat");

// Simulate to mine new blocks.
export async function increaseBlock(blockNumber: number) {
  while (blockNumber > 0) {
    blockNumber--;
    await hre.network.provider.request({
      method: "evm_mine",
      params: [],
    });
  }
}

// Simulate the time passed.
export async function increaseTime(time: number) {
  await hre.network.provider.request({
    method: "evm_increaseTime",
    params: [time],
  });
}

// Get current block number.
export async function getBlock() {
  const rawBlockNumber = await hre.network.provider.request({
    method: "eth_blockNumber",
    params: [],
  });
  return parseInt(rawBlockNumber, 16);
}

// Get current timestamp.
export async function getTimestamp() {
  const currentBlockNum = await getBlock();
  const currentBlock = await hre.ethres.provider.getBlock(currentBlockNum);
  return currentBlock.timestamp;
}

// Pause/Unpause mining automatically.
export async function miningAutomatically(automatic: boolean) {
  await hre.network.provider.send("evm_setAutomine", [automatic]);
}
