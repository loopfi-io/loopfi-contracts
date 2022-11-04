import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { fixtureDefault, loadFixture } from "../utils/fixturesSaddle";

describe("Saddle Voter Proxy", function () {
  let voter: Contract;
  let owner: Signer;

  before(async function () {
    ({ owner, voter } = await loadFixture(fixtureDefault));
  });

  it("Should be able to deploy", async function () {});
});
