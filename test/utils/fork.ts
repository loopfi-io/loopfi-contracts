import { ethers, network } from "hardhat";
import { BigNumber, Contract } from "ethers";
import { AddressZero } from "./constants";

let dfInstance: Contract | undefined;
let veDFInstance: Contract | undefined;
let veDFManagerInstance: Contract | undefined;
let chainId: ChainId;

enum ChainId {
  INVALID = 0,
  MAINNET = 1,
  KOVAN = 42,
  HARDHAT = 31337,
}

interface ContractAddresses {
  DF: string;
  DF_WHALE: string;
  VEDF: string;
  VEDF_MANAGER: string;
}

const addresses: Record<ChainId, ContractAddresses> = {
  [ChainId.INVALID]: {
    DF: AddressZero,
    DF_WHALE: AddressZero,
    VEDF: AddressZero,
    VEDF_MANAGER: AddressZero,
  },
  [ChainId.MAINNET]: {
    DF: "0x431ad2ff6a9C365805eBaD47Ee021148d6f7DBe0",
    DF_WHALE: "0x41CD3C317a7c58160B2F2d299861aeF97755D698",
    VEDF: "0x6050B7040cF4Ae3e60c3c1A5d0367B565a1460C1",
    VEDF_MANAGER: "0xc0d7f11455aacD225c6fd1Be7dDF0bCf93b31cb3",
  },
  [ChainId.KOVAN]: {
    DF: "0x79E40d67DA6eAE5eB4A93Fc6a56A7961625E15F3",
    DF_WHALE: "0xDbE0A1D39585d5e8C19c6d68121baB0c3B3DE11d",
    VEDF: "0x2C9671f4f7fd226D092A2c1715b9f03749358366",
    VEDF_MANAGER: "0x7259153980146593E1128d3460f356eC08FC25A5",
  },
  [ChainId.HARDHAT]: {
    DF: AddressZero,
    DF_WHALE: AddressZero,
    VEDF: AddressZero,
    VEDF_MANAGER: AddressZero,
  },
};

export async function allocateDF(df: Contract, to: string, amount: BigNumber) {
  const chainId = await getChainId();
  const dfWhale = addresses[chainId].DF_WHALE;

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [dfWhale],
  });

  const whale = await ethers.getSigner(dfWhale);

  // Owner may not have much ETH balance
  const [account] = await ethers.getSigners();
  await account.sendTransaction({
    to: dfWhale,
    value: ethers.utils.parseEther("10"),
  });

  await df.connect(whale).transfer(to, amount);
}

/*
Get the chain id from the network provider even with a hardhat fork.
*/
export async function initChainId() {
  let _chainId = network.config.chainId;

  // Handle the hardhat fork
  if (_chainId === 31337 && network.config.hasOwnProperty("forking")) {
    const provider = new ethers.providers.JsonRpcProvider(
      (network.config as any)["forking"].url
    );

    _chainId = (await provider.getNetwork()).chainId;
  }

  chainId = _chainId as ChainId;

  return chainId;
}

export async function getChainId() {
  return chainId ? chainId : await initChainId();
}

export async function getDFInstance() {
  return dfInstance
    ? dfInstance
    : await ethers.getContractAt("ERC20", addresses[await getChainId()].DF);
}

export async function getVEDFInstance() {
  return (
    veDFInstance ||
    (await ethers.getContractAt("IveDF", addresses[await getChainId()].VEDF))
  );
}

export async function getVEDFManagerInstance() {
  return veDFManagerInstance
    ? veDFManagerInstance
    : await ethers.getContractAt(
        "IveDFManager",
        addresses[await getChainId()].VEDF_MANAGER
      );
}
