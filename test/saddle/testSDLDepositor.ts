import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract, BigNumber } from "ethers";

import { AddressZero } from "../utils/constants";
import { fixtureDefault, loadFixture } from "../utils/fixturesSaddle";

describe("Saddle Depositor", function () {
  let accounts: Signer[];
  let owner: Signer;
  let user1: Signer;

  let SDL: Contract;
  let veSDL: Contract;
  let pSDL: Contract;

  let voter: Contract;
  let depositor: Contract;
  let pSDLStaking: Contract;

  let depositAmount: BigNumber;

  before(async function () {
    ({ owner, accounts, SDL, veSDL, pSDL, voter, depositor, pSDLStaking } =
      await loadFixture(fixtureDefault));

    user1 = accounts[0];
    depositAmount = ethers.utils.parseEther("1000");
  });

  it("Should be able to deposit", async function () {
    const beforeveSDLBalance = await veSDL.balanceOf(voter.address);
    // console.log("beforeveSDLBalance", beforeveSDLBalance.toString());

    await expect(() =>
      depositor
        .connect(user1)
        ["deposit(uint256,bool,address)"](depositAmount, true, AddressZero)
    ).to.changeTokenBalance(pSDL, user1, depositAmount);

    const afterveSDLBalance = await veSDL.balanceOf(voter.address);
    // console.log("afterveSDLBalance", afterveSDLBalance.toString());

    // Allow 1% delta
    expect(afterveSDLBalance.sub(beforeveSDLBalance)).to.closeTo(
      depositAmount,
      depositAmount.mul(1).div(100)
    );
  });

  it("Should be able to deposit and staking", async function () {
    const beforeveSDLBalance = await veSDL.balanceOf(voter.address);
    // console.log("beforeveSDLBalance", beforeveSDLBalance.toString());

    // Use `changeTokenBalance`, treat pSDLStaking as a ERC20
    await expect(() =>
      depositor
        .connect(user1)
        ["deposit(uint256,bool,address)"](
          depositAmount,
          true,
          pSDLStaking.address
        )
    ).to.changeTokenBalance(pSDLStaking, user1, depositAmount);

    const afterveSDLBalance = await veSDL.balanceOf(voter.address);
    // console.log("afterveSDLBalance", afterveSDLBalance.toString());

    // Allow 1% delta
    expect(afterveSDLBalance.sub(beforeveSDLBalance)).to.closeTo(
      depositAmount,
      depositAmount.mul(1).div(100)
    );
  });
});
