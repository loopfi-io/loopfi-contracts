import {
  allocateDF,
  getDFInstance,
  getVEDFInstance,
  getVEDFManagerInstance,
} from "./utils/fork";
import { ethers, network } from "hardhat";

async function main() {
  const df = await getDFInstance();
  const veDF = await getVEDFInstance();
  const veDFManager = await getVEDFManagerInstance();
  const account = (await ethers.getSigners())[0];
  const accountAddress = await account.getAddress();
  await allocateDF(df, accountAddress, ethers.utils.parseEther("1000000"));
  console.log((await df.balanceOf(accountAddress)).toString());
  console.log((await veDF.balanceOf(accountAddress)).toString());
  await df.approve(veDFManager.address, ethers.constants.MaxUint256);
  await veDFManager.createInOne(ethers.utils.parseEther("1000000"), 1681632000);
  console.log((await veDF.balanceOf(accountAddress)).toString());
}

main();
