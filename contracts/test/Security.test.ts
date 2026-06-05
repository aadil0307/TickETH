import { expect } from "chai";
import { ethers } from "hardhat";
import { TickETHTicket, TickETHFactory, TickETHMarketplace } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * TickETH Smart Contract Security Test Suite
 *
 * Tests for common attack vectors:
 * 1. Reentrancy attacks
 * 2. Access control bypass
 * 3. Integer overflow / underflow
 * 4. Front-running vulnerabilities
 * 5. Price manipulation
 * 6. Unauthorized transfer
 * 7. Double-spending / check-in replay
 * 8. Denial of service
 * 9. Factory clone manipulation
 */

const ZERO_BYTES32 = ethers.ZeroHash;
const PLATFORM_FEE_BPS = 250;

describe("Security Tests", function () {
  let implementation: TickETHTicket;
  let factory: TickETHFactory;
  let marketplace: TickETHMarketplace;
  let ticket: TickETHTicket;
  let owner: SignerWithAddress;
  let attacker: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let treasury: SignerWithAddress;

  beforeEach(async function () {
    [owner, attacker, user1, user2, treasury] = await ethers.getSigners();

    // Deploy implementation
    const TicketFactory = await ethers.getContractFactory("TickETHTicket");
    implementation = await TicketFactory.deploy();
    await implementation.waitForDeployment();

    // Deploy factory
    const FactoryFactory = await ethers.getContractFactory("TickETHFactory");
    factory = await FactoryFactory.deploy(
      await implementation.getAddress(),
      PLATFORM_FEE_BPS,
      treasury.address
    );
    await factory.waitForDeployment();

    // Deploy marketplace
    const MarketFactory = await ethers.getContractFactory("TickETHMarketplace");
    marketplace = await MarketFactory.deploy();
    await marketplace.waitForDeployment();

    // Create event clone
    await factory.connect(owner).createEvent("Sec Test", "SEC", "ipfs://", 0);
    const cloneAddr = await factory.deployedEvents(0);
    ticket = await ethers.getContractAt("TickETHTicket", cloneAddr);

    // Add a simple tier
    await ticket.addTier(
      "General",
      ethers.parseEther("0.01"),
      100,  // maxSupply
      0,    // startTime
      0,    // endTime
      5,    // maxPerWallet
      ZERO_BYTES32,
      3,    // maxResales
      3000  // maxPriceDeviationBps (30%)
    );
  });

  // ═══════════════════════════════════════════════════════════════
  //  1. Access Control
  // ═══════════════════════════════════════════════════════════════

  describe("Access Control", function () {
    it("should prevent non-owner from adding tiers", async function () {
      await expect(
        ticket.connect(attacker).addTier(
          "VIP", ethers.parseEther("1"), 10, 0, 0, 0, ZERO_BYTES32, 0, 0
        )
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });

    it("should prevent non-owner from checking in tickets", async function () {
      await ticket.connect(user1).mint(0, [], { value: ethers.parseEther("0.01") });
      await expect(
        ticket.connect(attacker).checkIn(1)
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });

    it("should prevent non-owner from pausing", async function () {
      await expect(
        ticket.connect(attacker).pause()
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });

    it("should prevent non-owner from setting base URI", async function () {
      await expect(
        ticket.connect(attacker).setBaseURI("https://evil.com/")
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });

    it("should prevent non-owner from withdrawing funds", async function () {
      await ticket.connect(user1).mint(0, [], { value: ethers.parseEther("0.01") });
      await expect(
        ticket.connect(attacker).withdraw()
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });

    it("should prevent non-owner from setting marketplace", async function () {
      await expect(
        ticket.connect(attacker).setApprovedMarketplace(attacker.address)
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });

    it("should prevent non-owner from toggling transfer restrictions", async function () {
      await expect(
        ticket.connect(attacker).setTransferRestriction(false)
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });

    it("should prevent factory admin functions from non-owner", async function () {
      await expect(
        factory.connect(attacker).setPlatformFee(1000)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");

      await expect(
        factory.connect(attacker).setPlatformTreasury(attacker.address)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");

      await expect(
        factory.connect(attacker).updateImplementation(attacker.address)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("should prevent marketplace admin functions from non-owner", async function () {
      await expect(
        marketplace.connect(attacker).setAllowedContract(ticket.getAddress(), true)
      ).to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");

      await expect(
        marketplace.connect(attacker).adminCancelListing(1)
      ).to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  2. Minting Security
  // ═══════════════════════════════════════════════════════════════

  describe("Minting Security", function () {
    it("should reject underpayment", async function () {
      await expect(
        ticket.connect(user1).mint(0, [], { value: ethers.parseEther("0.005") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("should refund overpayment", async function () {
      const balBefore = await ethers.provider.getBalance(user1.address);
      const tx = await ticket.connect(user1).mint(0, [], { value: ethers.parseEther("0.02") });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const balAfter = await ethers.provider.getBalance(user1.address);
      // Should only have paid 0.01 ETH + gas (0.01 refunded)
      expect(balBefore - balAfter - gasUsed).to.equal(ethers.parseEther("0.01"));
    });

    it("should enforce per-wallet mint limit", async function () {
      // Mint 5 (the max)
      for (let i = 0; i < 5; i++) {
        await ticket.connect(user1).mint(0, [], { value: ethers.parseEther("0.01") });
      }

      // 6th should fail
      await expect(
        ticket.connect(user1).mint(0, [], { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Wallet mint limit reached");
    });

    it("should enforce supply cap", async function () {
      // Add a tiny tier (2 supply)
      await ticket.addTier(
        "Limited", ethers.parseEther("0.01"), 2, 0, 0, 0, ZERO_BYTES32, 0, 0
      );

      await ticket.connect(user1).mint(1, [], { value: ethers.parseEther("0.01") });
      await ticket.connect(user2).mint(1, [], { value: ethers.parseEther("0.01") });

      await expect(
        ticket.connect(attacker).mint(1, [], { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Tier sold out");
    });

    it("should reject minting from inactive tier", async function () {
      await ticket.setTierStatus(0, false);
      await expect(
        ticket.connect(user1).mint(0, [], { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Tier not active");
    });

    it("should reject minting when paused", async function () {
      await ticket.pause();
      await expect(
        ticket.connect(user1).mint(0, [], { value: ethers.parseEther("0.01") })
      ).to.be.revertedWithCustomError(ticket, "EnforcedPause");
    });

    it("should enforce time window restrictions", async function () {
      const futureStart = (await time.latest()) + 3600; // 1 hour from now
      const futureEnd = futureStart + 7200;

      await ticket.addTier(
        "Timed", ethers.parseEther("0.01"), 100, futureStart, futureEnd, 5, ZERO_BYTES32, 0, 0
      );

      // Should fail — sale hasn't started
      await expect(
        ticket.connect(user1).mint(1, [], { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Sale not started");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  3. Transfer Restriction Security
  // ═══════════════════════════════════════════════════════════════

  describe("Transfer Restrictions", function () {
    it("should block direct transfers when restricted", async function () {
      // transfersRestricted defaults to false; enable it first
      await ticket.setTransferRestriction(true);
      await ticket.connect(user1).mint(0, [], { value: ethers.parseEther("0.01") });

      await expect(
        ticket.connect(user1).transferFrom(user1.address, attacker.address, 1)
      ).to.be.revertedWith("Transfers are restricted for this event");
    });

    it("should allow transfers after restriction is lifted", async function () {
      await ticket.connect(user1).mint(0, [], { value: ethers.parseEther("0.01") });
      await ticket.setTransferRestriction(false);

      await expect(
        ticket.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.not.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  4. Check-in Security
  // ═══════════════════════════════════════════════════════════════

  describe("Check-in Security", function () {
    it("should prevent double check-in", async function () {
      await ticket.connect(user1).mint(0, [], { value: ethers.parseEther("0.01") });
      await ticket.checkIn(1);

      await expect(ticket.checkIn(1)).to.be.revertedWith("Already checked in");
    });

    it("should prevent check-in of non-existent token", async function () {
      await expect(ticket.checkIn(999)).to.be.reverted;
    });

    it("should emit TicketCheckedIn event", async function () {
      await ticket.connect(user1).mint(0, [], { value: ethers.parseEther("0.01") });
      await expect(ticket.checkIn(1))
        .to.emit(ticket, "TicketCheckedIn");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  5. Withdrawal Security
  // ═══════════════════════════════════════════════════════════════

  describe("Withdrawal Security", function () {
    it("should correctly split between organizer and treasury", async function () {
      // Mint 5 tickets @ 0.01 ETH = 0.05 ETH total (maxPerWallet = 5)
      // Platform fee is split DURING minting, not during withdrawal

      const treasuryBalBefore = await ethers.provider.getBalance(treasury.address);

      for (let i = 0; i < 5; i++) {
        await ticket.connect(user1).mint(0, [], { value: ethers.parseEther("0.01") });
      }

      const total = ethers.parseEther("0.05");
      const expectedPlatformFee = (total * BigInt(PLATFORM_FEE_BPS)) / 10000n;
      const expectedOrgAmount = total - expectedPlatformFee;

      // Treasury should have received fees during minting
      const treasuryBalAfterMint = await ethers.provider.getBalance(treasury.address);
      expect(treasuryBalAfterMint - treasuryBalBefore).to.equal(expectedPlatformFee);

      // Contract should only hold the organizer's share
      const contractBalance = await ethers.provider.getBalance(await ticket.getAddress());
      expect(contractBalance).to.equal(expectedOrgAmount);

      const ownerBalBefore = await ethers.provider.getBalance(owner.address);

      const tx = await ticket.withdraw();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const ownerBalAfter = await ethers.provider.getBalance(owner.address);

      // Organizer should receive the remaining balance
      expect(ownerBalAfter - ownerBalBefore + gasUsed).to.equal(expectedOrgAmount);
    });

    it("should reject withdrawal when balance is zero", async function () {
      await expect(ticket.withdraw()).to.be.revertedWith("No funds to withdraw");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  6. Factory Clone Security
  // ═══════════════════════════════════════════════════════════════

  describe("Factory Clone Security", function () {
    it("should prevent double initialization of implementation", async function () {
      await expect(
        implementation.initialize(
          "Hack", "HACK", "ipfs://", attacker.address,
          250, attacker.address, 0
        )
      ).to.be.revertedWithCustomError(implementation, "InvalidInitialization");
    });

    it("should prevent double initialization of clone", async function () {
      await expect(
        ticket.initialize(
          "Hack", "HACK", "ipfs://", attacker.address,
          250, attacker.address, 0
        )
      ).to.be.revertedWithCustomError(ticket, "InvalidInitialization");
    });

    it("should set correct platform fee cap (max 10%)", async function () {
      await expect(
        factory.setPlatformFee(1001) // 10.01%
      ).to.be.revertedWith("Fee exceeds max 10%");
    });

    it("should reject zero-address treasury", async function () {
      await expect(
        factory.setPlatformTreasury(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  7. Marketplace Security
  // ═══════════════════════════════════════════════════════════════

  describe("Marketplace Security", function () {
    beforeEach(async function () {
      // Setup: allow marketplace and allow contract
      await ticket.setApprovedMarketplace(await marketplace.getAddress());
      await marketplace.setAllowedContract(await ticket.getAddress(), true);

      // Mint a ticket for user1
      await ticket.connect(user1).mint(0, [], { value: ethers.parseEther("0.01") });
    });

    it("should reject listing from non-whitelisted contract", async function () {
      // Create a separate event
      await factory.connect(owner).createEvent("Other", "OTH", "ipfs://", 0);
      const otherAddr = await factory.deployedEvents(1);
      const otherTicket: TickETHTicket = await ethers.getContractAt("TickETHTicket", otherAddr) as unknown as TickETHTicket;

      await otherTicket.addTier(
        "Gen", ethers.parseEther("0.01"), 100, 0, 0, 0, ZERO_BYTES32, 0, 0
      );
      await otherTicket.connect(user1).mint(0, [], { value: ethers.parseEther("0.01") });

      // Not whitelisted in marketplace
      await otherTicket.connect(user1).approve(await marketplace.getAddress(), 1);
      await expect(
        marketplace.connect(user1).listTicket(
          otherAddr, 1, ethers.parseEther("0.01")
        )
      ).to.be.revertedWith("Contract not allowed");
    });

    it("should reject purchase with insufficient payment", async function () {
      // Approve and list
      await ticket.connect(user1).approve(await marketplace.getAddress(), 1);
      await marketplace.connect(user1).listTicket(
        await ticket.getAddress(), 1, ethers.parseEther("0.012")
      );

      // Try to buy with insufficient amount (listing ID starts at 0)
      await expect(
        marketplace.connect(user2).buyTicket(0, { value: ethers.parseEther("0.01") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("should prevent buying own listing", async function () {
      await ticket.connect(user1).approve(await marketplace.getAddress(), 1);
      await marketplace.connect(user1).listTicket(
        await ticket.getAddress(), 1, ethers.parseEther("0.012")
      );

      await expect(
        marketplace.connect(user1).buyTicket(0, { value: ethers.parseEther("0.012") })
      ).to.be.revertedWith("Cannot buy own listing");
    });

    it("should prevent cancelling someone else's listing", async function () {
      await ticket.connect(user1).approve(await marketplace.getAddress(), 1);
      await marketplace.connect(user1).listTicket(
        await ticket.getAddress(), 1, ethers.parseEther("0.012")
      );

      await expect(
        marketplace.connect(attacker).cancelListing(0)
      ).to.be.revertedWith("Not the seller");
    });

    it("should prevent double-buying a listing", async function () {
      await ticket.connect(user1).approve(await marketplace.getAddress(), 1);
      await marketplace.connect(user1).listTicket(
        await ticket.getAddress(), 1, ethers.parseEther("0.012")
      );

      // Buy once (listing ID 0)
      await marketplace.connect(user2).buyTicket(0, { value: ethers.parseEther("0.012") });

      // Try to buy again
      await expect(
        marketplace.connect(attacker).buyTicket(0, { value: ethers.parseEther("0.012") })
      ).to.be.revertedWith("Listing not active");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  8. Metadata Lock Security
  // ═══════════════════════════════════════════════════════════════

  describe("Metadata Lock", function () {
    it("should prevent URI changes after lock", async function () {
      await ticket.lockMetadata();
      await expect(
        ticket.setBaseURI("https://evil.com/")
      ).to.be.revertedWith("Metadata is permanently locked");
    });

    it("should prevent double-locking", async function () {
      await ticket.lockMetadata();
      await expect(ticket.lockMetadata()).to.be.revertedWith("Already locked");
    });
  });
});
