import { ethers } from "hardhat";

/**
 * Deployment script for OPN Pulse Yield Optimizer.
 *
 * PRIVATE KEY:
 * - Loaded automatically from .env (via dotenv in hardhat.config.ts)
 * - Or set via $env:PRIVATE_KEY in PowerShell before running.
 * - Use a dedicated burner/test wallet only. Never use a key that holds real value.
 * - The key never leaves your local machine.
 */

async function main() {
  const [deployer] = await ethers.getSigners();

  if (!deployer) {
    console.error("\n❌ ERROR: No deployer account found!");
    console.error("Please create a .env file in the contracts/ folder with your PRIVATE_KEY.");
    console.error("Example: copy .env.example .env  then edit it.");
    console.error("Or set it temporarily with:  $env:PRIVATE_KEY=\"0x...\"");
    process.exit(1);
  }

  console.log("Deploying OPN Pulse Yield Optimizer with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // 1. Deploy the test asset
  const MockAsset = await ethers.getContractFactory("MockAsset");
  const asset = await MockAsset.deploy();
  await asset.waitForDeployment();
  const assetAddress = await asset.getAddress();
  console.log("MockAsset (tOPN) deployed to:", assetAddress);

  // Mint some for the deployer for testing
  const initialMint = ethers.parseUnits("1000000", 18); // 1M for demo
  await asset.mint(deployer.address, initialMint);
  console.log("Minted 1,000,000 tOPN to deployer");

  // 2. Deploy the vault
  const PulseVault = await ethers.getContractFactory("PulseVault");
  const vault = await PulseVault.deploy(
    assetAddress,
    "OPN Pulse Vault",
    "pOPN"
  );
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("PulseVault deployed to:", vaultAddress);

  // 3. Deploy two strategies
  const MockLendingStrategy = await ethers.getContractFactory("MockLendingStrategy");
  const lendingStrat = await MockLendingStrategy.deploy(assetAddress, vaultAddress);
  await lendingStrat.waitForDeployment();
  const lendingAddress = await lendingStrat.getAddress();
  console.log("MockLendingStrategy deployed to:", lendingAddress);

  const MockDexStrategy = await ethers.getContractFactory("MockDexStrategy");
  const dexStrat = await MockDexStrategy.deploy(assetAddress, vaultAddress);
  await dexStrat.waitForDeployment();
  const dexAddress = await dexStrat.getAddress();
  console.log("MockDexStrategy deployed to:", dexAddress);

  // 4. Add strategies to vault with allocations (60% lending, 40% dex)
  await vault.addStrategy(lendingAddress, 6000);
  await vault.addStrategy(dexAddress, 4000);
  console.log("Strategies added to vault (60/40 split)");

  // Optional: seed the vault with some capital from deployer to bootstrap TVL
  const seedAmount = ethers.parseUnits("50000", 18);
  await asset.approve(vaultAddress, seedAmount);
  await vault.deposit(seedAmount, deployer.address);
  console.log("Seeded vault with 50,000 tOPN from deployer");

  // Do an initial harvest so numbers look alive
  await vault.harvestAndRebalance();
  console.log("Initial harvest/rebalance executed");

  console.log("\n=== DEPLOYMENT COMPLETE ===");
  console.log("Network: OPN Testnet (984)");
  console.log("tOPN (MockAsset):", assetAddress);
  console.log("PulseVault (pOPN):", vaultAddress);
  console.log("LendingStrategy:", lendingAddress);
  console.log("DexStrategy:", dexAddress);
  console.log("\nNext steps:");
  console.log("1. Verify contracts on https://testnet.iopn.tech");
  console.log("2. Use the frontend to interact and generate on-chain activity");
  console.log("3. Submit to https://builders.iopn.tech with these addresses");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
