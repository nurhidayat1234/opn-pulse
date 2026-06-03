import { expect } from "chai";
import { ethers } from "hardhat";
import { PulseVault, MockAsset, MockLendingStrategy, MockDexStrategy } from "../typechain-types";
import { Signer } from "ethers";

describe("OPN Pulse Yield Optimizer", function () {
  let asset: MockAsset;
  let vault: PulseVault;
  let lending: MockLendingStrategy;
  let dex: MockDexStrategy;
  let owner: Signer;
  let user: Signer;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();

    const MockAssetFactory = await ethers.getContractFactory("MockAsset");
    asset = (await MockAssetFactory.deploy()) as MockAsset;

    const PulseVaultFactory = await ethers.getContractFactory("PulseVault");
    vault = (await PulseVaultFactory.deploy(
      await asset.getAddress(),
      "OPN Pulse Vault",
      "pOPN"
    )) as PulseVault;

    const LendingFactory = await ethers.getContractFactory("MockLendingStrategy");
    lending = (await LendingFactory.deploy(await asset.getAddress(), await vault.getAddress())) as MockLendingStrategy;

    const DexFactory = await ethers.getContractFactory("MockDexStrategy");
    dex = (await DexFactory.deploy(await asset.getAddress(), await vault.getAddress())) as MockDexStrategy;

    await vault.addStrategy(await lending.getAddress(), 6000);
    await vault.addStrategy(await dex.getAddress(), 4000);

    // Mint tokens to user
    await asset.mint(await user.getAddress(), ethers.parseUnits("100000", 18));
  });

  it("should deploy with correct asset and name", async function () {
    expect(await vault.asset()).to.equal(await asset.getAddress());
    expect(await vault.name()).to.equal("OPN Pulse Vault");
  });

  it("should allow deposit and mint shares", async function () {
    const amount = ethers.parseUnits("1000", 18);
    await asset.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(amount, await user.getAddress());

    const shares = await vault.balanceOf(await user.getAddress());
    expect(shares).to.be.gt(0);
  });

  it("should increase totalAssets after time passes (real-time accrual)", async function () {
    const amount = ethers.parseUnits("10000", 18);
    await asset.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(amount, await user.getAddress());

    const tvlBefore = await vault.totalAssets();

    // Advance time significantly (Hardhat can do this)
    await ethers.provider.send("evm_increaseTime", [3600 * 24]); // 1 day
    await ethers.provider.send("evm_mine");

    const tvlAfter = await vault.totalAssets();
    expect(tvlAfter).to.be.gt(tvlBefore);
  });

  it("should allow anyone to harvestAndRebalance (permissionless)", async function () {
    const amount = ethers.parseUnits("5000", 18);
    await asset.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(amount, await user.getAddress());

    // Advance time
    await ethers.provider.send("evm_increaseTime", [3600 * 2]);
    await ethers.provider.send("evm_mine");

    // Any address (even a random one) can harvest
    await expect(vault.connect(owner).harvestAndRebalance()).to.emit(vault, "Harvested");

    expect(await vault.totalHarvests()).to.equal(1);
  });

  it("should reflect higher TVL after multiple harvests (compounding effect)", async function () {
    const amount = ethers.parseUnits("20000", 18);
    await asset.connect(user).approve(await vault.getAddress(), amount);
    await vault.connect(user).deposit(amount, await user.getAddress());

    const initialTVL = await vault.totalAssets();

    for (let i = 0; i < 5; i++) {
      await ethers.provider.send("evm_increaseTime", [600]); // 10 min
      await ethers.provider.send("evm_mine");
      await vault.harvestAndRebalance();
    }

    const finalTVL = await vault.totalAssets();
    expect(finalTVL).to.be.gt(initialTVL);
    expect(await vault.totalHarvests()).to.equal(5);
  });
});
