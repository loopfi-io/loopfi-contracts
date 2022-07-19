import { ethers } from "hardhat";
import { Signer, Contract } from "ethers";
import { AddressZero, MAX } from "./utils/constants";
import { loadFixture, fixtureL2 } from "./utils/fixtures";

describe("APYHelper", function () {
  let accounts: Signer[];
  let df: Contract;
  let depositorL2: Contract;
  let depositor: Contract;
  let stakingPoolL2: Contract;
  let boosterL2: Contract;
  let booster: Contract;
  let apyHelper: Contract;
  let apyHelperL2: Contract;
  let veDFEscrow: Contract;
  let voter: Contract;
  let pDFL2: Contract;

  before(async function () {
    ({
      accounts,
      df,
      booster,
      depositor,
      depositorL2,
      stakingPoolL2,
      boosterL2,
      veDFEscrow,
      voter,
      apyHelper,
      apyHelperL2,
      pDFL2,
    } = await loadFixture(fixtureL2));
  });

  it("Mainnet - Should be able to get APY", async function () {
    const apy = await apyHelper.callStatic.getAPY5(
      veDFEscrow.address,
      voter.address,
      booster.address,
      df.address,
      df.address
    );

    console.log("apy:", apy.toString());
  });

  it("L2 - Should be able to get APY", async function () {
    const user1 = accounts[0];
    const depositAmount = ethers.utils.parseEther("1000"); // 1000
    await df.connect(user1).approve(depositorL2.address, MAX);

    await depositorL2
      .connect(user1)
      ["deposit(uint256,bool,address)"](
        depositAmount,
        true,
        stakingPoolL2.address
      );

    await depositor.lockDF();

    const apy = await apyHelper.callStatic.getAPY5(
      veDFEscrow.address,
      voter.address,
      booster.address,
      df.address,
      df.address
    );

    console.log("apy:", apy.toString());

    const apyL2 = await apyHelperL2.callStatic.getAPY4(
      apy,
      boosterL2.address,
      pDFL2.address,
      stakingPoolL2.address
    );

    console.log("apyL2:", apyL2.toString());
  });
});
