import { ethers } from "hardhat";
import { expect } from "chai";
import { Signer, Contract } from "ethers";
import { deployContract } from "./utils/fixtures";

describe("Loopfi Token", function () {
  let accounts: Signer[];
  let lpf: Contract;
  let minterAddresses: string[];

  before(async function () {
    lpf = await deployContract("Loopfi", []);
    accounts = (await ethers.getSigners()).slice(0, 3);

    minterAddresses = await Promise.all(
      accounts.map(async (account) => await account.getAddress())
    );
  });

  describe("Add minters", function () {
    it("Should be able to add minters", async function () {
      const cap = ethers.utils.parseEther("1000"); // 1000

      await lpf.addMinters(minterAddresses, [cap, cap.mul(2), cap.mul(3)]);
    });

    it("Should not be able to add duplicated minters", async function () {
      const cap = ethers.utils.parseEther("1000"); // 1000

      await lpf.removeMinter(minterAddresses[2]);

      await expect(
        lpf.addMinters([minterAddresses[2], minterAddresses[2]], [cap, cap])
      ).to.revertedWith("alreadyAdded");

      await lpf.addMinters([minterAddresses[2]], [cap.mul(3)]);
    });

    it("Should not be able to add existed minters", async function () {
      const cap = ethers.utils.parseEther("1000"); // 1000

      await expect(lpf.addMinters([minterAddresses[2]], [cap])).to.revertedWith(
        "alreadyAdded"
      );
    });

    it("Should not be able to add minter caps > max supply", async function () {
      const cap = ethers.utils.parseEther("1000"); // 1000

      await lpf.removeMinter(minterAddresses[1]);
      await lpf.removeMinter(minterAddresses[2]);

      const maxSupply = await lpf.maxSupply();

      await expect(
        lpf.addMinters(
          [minterAddresses[1], minterAddresses[2]],
          [maxSupply.div(2), maxSupply.div(2)]
        )
      ).to.be.revertedWith(">maxSupply");

      await lpf.addMinters(
        [minterAddresses[1], minterAddresses[2]],
        [cap.mul(2), cap.mul(3)]
      );
    });
  });

  describe("Get minters and data", function () {
    it("Should be able to get minters", async function () {
      const minters = await lpf.getMinters();

      expect(minters).to.deep.equal(minterAddresses);
    });

    it("Should be able to get minters data", async function () {
      const cap = ethers.utils.parseEther("1000"); // 1000
      const minters = await lpf.getMinters();

      let index = 0;
      for (const minter of minters) {
        const data = await lpf.minterData(minter);

        expect(minter).to.equal(minterAddresses[index]);
        expect(data.cap).to.equal(cap.mul(index + 1));
        expect(data.mint).to.equal(0);

        index++;
      }
    });
  });

  describe("Set Minter Caps", function () {
    it("Should be able to set minter caps", async function () {
      const newCap = ethers.utils.parseEther("100"); // 1000

      await lpf.setMinterCaps([minterAddresses[0]], [newCap]);

      const data = await lpf.minterData(minterAddresses[0]);

      expect(data.cap).to.equal(newCap);
      expect(data.mint).to.equal(0);
    });

    it("Should not be able to set non-existed minter caps", async function () {
      const cap = ethers.utils.parseEther("1000"); // 1000

      await lpf.removeMinter(minterAddresses[0]);

      await expect(
        lpf.setMinterCaps([minterAddresses[0]], [cap])
      ).to.be.revertedWith("!minter");

      await lpf.addMinters([minterAddresses[0]], [cap]);
    });

    it("Should not be able to set minter caps > max supply", async function () {
      const maxSupply = await lpf.maxSupply();

      await expect(
        lpf.setMinterCaps(
          [minterAddresses[0], minterAddresses[1]],
          [maxSupply.div(2), maxSupply.div(2)]
        )
      ).to.be.revertedWith(">maxSupply");
    });
  });

  describe("Remove Minter", function () {
    it("Should not be able to remove non-existed minter", async function () {
      await expect(lpf.removeMinter(lpf.address)).to.be.revertedWith("!minter");
    });

    it("Should not be able to remove minter with minted", async function () {
      await lpf
        .connect(accounts[0])
        .mint(minterAddresses[0], ethers.utils.parseEther("100"));

      await expect(lpf.removeMinter(minterAddresses[0])).to.be.revertedWith(
        "can not remove minted minter"
      );
    });

    it("Should be able to remove minter", async function () {
      await lpf.removeMinter(minterAddresses[1]);

      const minters = await lpf.getMinters();
      expect(minters.length).to.equal(2);
      expect(minters).to.have.members([minterAddresses[0], minterAddresses[2]]);
    });
  });

  describe("Check mint cap", function () {
    it("Should be able to mint", async function () {
      const amount = ethers.utils.parseEther("100");

      const mintBefore = (await lpf.minterData(minterAddresses[0])).mint;

      await expect(async () => {
        await lpf.connect(accounts[0]).mint(minterAddresses[0], amount);
      }).to.changeTokenBalance(lpf, accounts[0], amount);

      const mintAfter = (await lpf.minterData(minterAddresses[0])).mint;

      expect(mintAfter).to.equal(mintBefore.add(amount));
    });

    it("Should not be able to mint more than cap ", async function () {
      const { cap, mint } = await lpf.minterData(minterAddresses[0]);

      const amount = cap.sub(mint);

      const mintBefore = (await lpf.minterData(minterAddresses[0])).mint;

      // Mint amount+1 should get amount
      await expect(async () => {
        await lpf.connect(accounts[0]).mint(minterAddresses[0], amount.add(1));
      }).to.changeTokenBalance(lpf, accounts[0], amount);

      const mintAfter = (await lpf.minterData(minterAddresses[0])).mint;

      expect(mintAfter).to.equal(mintBefore.add(amount));

      await expect(async () => {
        await lpf.connect(accounts[0]).mint(minterAddresses[0], 1);
      }).to.changeTokenBalance(lpf, accounts[0], 0);

      const mintAfter2 = (await lpf.minterData(minterAddresses[0])).mint;

      expect(mintAfter2).to.equal(mintAfter);
    });
  });
});
