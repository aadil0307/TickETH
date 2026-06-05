import { ethers, network } from "hardhat";

// ─── Configuration ────────────────────────────────────────────
// Platform fee: 250 bps = 2.5%
const PLATFORM_FEE_BPS = 250;
// Set this to your platform treasury wallet address
const PLATFORM_TREASURY = process.env.PLATFORM_TREASURY || "";

async function main() {
  const [deployer] = await ethers.getSigners();

  // Use deployer as treasury if not set (dev only)
  const treasury = PLATFORM_TREASURY || deployer.address;

  console.log("=".repeat(60));
  console.log("  TickETH Smart Contract Deployment");
  console.log("=".repeat(60));
  console.log(`  Network:       ${network.name}`);
  console.log(`  Chain ID:      ${(await ethers.provider.getNetwork()).chainId}`);
  console.log(`  Deployer:      ${deployer.address}`);
  console.log(
    `  Balance:       ${ethers.formatEther(
      await ethers.provider.getBalance(deployer.address)
    )} MATIC`
  );
  console.log(`  Platform Fee:  ${PLATFORM_FEE_BPS} bps (${PLATFORM_FEE_BPS / 100}%)`);
  console.log(`  Treasury:      ${treasury}`);
  console.log("=".repeat(60));

  // ─── Step 1: Deploy Implementation ──────────────────────────
  console.log("\n[1/2] Deploying TickETHTicket implementation...");
  const TickETHTicket = await ethers.getContractFactory("TickETHTicket");
  const implementation = await TickETHTicket.deploy();
  await implementation.waitForDeployment();
  const implAddress = await implementation.getAddress();
  console.log(`       Implementation deployed: ${implAddress}`);

  // ─── Step 2: Deploy Factory ─────────────────────────────────
  console.log("\n[2/3] Deploying TickETHFactory...");
  const TickETHFactory = await ethers.getContractFactory("TickETHFactory");
  const factory = await TickETHFactory.deploy(
    implAddress,
    PLATFORM_FEE_BPS,
    treasury
  );
  await factory.waitForDeployment();
  const factoryAddress = await factory.getAddress();
  console.log(`       Factory deployed:        ${factoryAddress}`);

  // ─── Step 3: Deploy Marketplace ─────────────────────────────
  console.log("\n[3/3] Deploying TickETHMarketplace...");
  const TickETHMarketplace = await ethers.getContractFactory("TickETHMarketplace");
  const marketplace = await TickETHMarketplace.deploy();
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  console.log(`       Marketplace deployed:    ${marketplaceAddress}`);

  // ─── Summary ────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("  Deployment Complete!");
  console.log("=".repeat(60));
  console.log(`  Implementation:  ${implAddress}`);
  console.log(`  Factory:         ${factoryAddress}`);
  console.log(`  Marketplace:     ${marketplaceAddress}`);
  console.log(`  Platform Fee:    ${PLATFORM_FEE_BPS} bps`);
  console.log(`  Treasury:        ${treasury}`);
  console.log("=".repeat(60));

  // ─── Verification Instructions ──────────────────────────────
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log("\n  To verify contracts on Polygonscan:");
    console.log(
      `    npx hardhat verify --network ${network.name} ${implAddress}`
    );
    console.log(
      `    npx hardhat verify --network ${network.name} ${factoryAddress} "${implAddress}" ${PLATFORM_FEE_BPS} "${treasury}"`
    );
    console.log(
      `    npx hardhat verify --network ${network.name} ${marketplaceAddress}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
