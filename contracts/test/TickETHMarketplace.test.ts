import { expect } from "chai";
import { ethers } from "hardhat";
import { TickETHTicket, TickETHFactory, TickETHMarketplace } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { time } from "@nomicfoundation/hardhat-network-helpers";

// ── Constants ──
const ZERO_BYTES32 = ethers.ZeroHash;
const PLATFORM_FEE_BPS = 250; // 2.5%

describe("TickETHMarketplace", function () {
  let implementation: TickETHTicket;
  let factory: TickETHFactory;
  let ticket: TickETHTicket;
  let marketplace: TickETHMarketplace;
  let admin: SignerWithAddress;
  let organizer: SignerWithAddress;
  let seller: SignerWithAddress;
  let buyer: SignerWithAddress;
  let buyer2: SignerWithAddress;
  let treasury: SignerWithAddress;

  const BASE_URI = "https://api.ticketh.com/metadata/";

  beforeEach(async function () {
    [admin, organizer, seller, buyer, buyer2, treasury] =
      await ethers.getSigners();

    // Deploy implementation
    const TickETHTicketFactory =
      await ethers.getContractFactory("TickETHTicket");
    implementation = await TickETHTicketFactory.deploy();
    await implementation.waitForDeployment();

    // Deploy factory
    const TickETHFactoryFactory =
      await ethers.getContractFactory("TickETHFactory");
    factory = await TickETHFactoryFactory.deploy(
      await implementation.getAddress(),
      PLATFORM_FEE_BPS,
      treasury.address
    );
    await factory.waitForDeployment();

    // Deploy marketplace
    const MarketplaceFactory =
      await ethers.getContractFactory("TickETHMarketplace");
    marketplace = await MarketplaceFactory.deploy();
    await marketplace.waitForDeployment();

    // Create ticket contract via factory (organizer is the event owner)
    await factory.connect(organizer).createEvent("Resale Event", "RSLE", BASE_URI, 0);
    const cloneAddress = await factory.deployedEvents(0);
    ticket = await ethers.getContractAt("TickETHTicket", cloneAddress);

    // Set marketplace as approved on the ticket contract
    await ticket.connect(organizer).setApprovedMarketplace(await marketplace.getAddress());

    // Allow the ticket contract on the marketplace
    await marketplace.setAllowedContract(await ticket.getAddress(), true);
  });

  /** Helper: add a tier with resale settings */
  async function addResaleTier(
    name: string,
    priceEth: string,
    supply: number,
    maxResales: number,
    maxPriceDeviationBps: number
  ) {
    return ticket.connect(organizer).addTier(
      name,
      ethers.parseEther(priceEth),
      supply,
      0, 0, 0, ZERO_BYTES32,
      maxResales,
      maxPriceDeviationBps
    );
  }

  /** Helper: mint a ticket to a signer */
  async function mintTo(signer: SignerWithAddress, tierId: number, priceEth: string) {
    return ticket.connect(signer).mint(tierId, [], { value: ethers.parseEther(priceEth) });
  }

  /** Helper: full list flow (approve + list) */
  async function listTicket(
    listedBy: SignerWithAddress,
    tokenId: number,
    askingPriceEth: string
  ) {
    await ticket.connect(listedBy).approve(await marketplace.getAddress(), tokenId);
    return marketplace.connect(listedBy).listTicket(
      await ticket.getAddress(),
      tokenId,
      ethers.parseEther(askingPriceEth)
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  Setup & Configuration
  // ═══════════════════════════════════════════════════════════════

  describe("Setup", function () {
    it("should set approved marketplace on ticket contract", async function () {
      expect(await ticket.approvedMarketplace()).to.equal(
        await marketplace.getAddress()
      );
    });

    it("should allow contract on marketplace", async function () {
      expect(
        await marketplace.allowedContracts(await ticket.getAddress())
      ).to.be.true;
    });

    it("should NOT allow non-owner to set approved marketplace", async function () {
      await expect(
        ticket.connect(seller).setApprovedMarketplace(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });

    it("should NOT allow non-owner to set allowed contracts", async function () {
      await expect(
        marketplace.connect(seller).setAllowedContract(await ticket.getAddress(), false)
      ).to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
    });

    it("should emit event when marketplace approved", async function () {
      await expect(
        ticket.connect(organizer).setApprovedMarketplace(buyer.address)
      )
        .to.emit(ticket, "ApprovedMarketplaceUpdated")
        .withArgs(buyer.address);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Resale Info on Ticket Contract
  // ═══════════════════════════════════════════════════════════════

  describe("Resale Info", function () {
    it("should store original mint price", async function () {
      await addResaleTier("VIP", "0.5", 100, 5, 1000);
      await mintTo(seller, 0, "0.5");

      expect(await ticket.originalMintPrice(1)).to.equal(
        ethers.parseEther("0.5")
      );
    });

    it("should return correct resale info", async function () {
      await addResaleTier("General", "0.1", 100, 3, 2000);
      await mintTo(seller, 0, "0.1");

      const info = await ticket.getResaleInfo(1);
      expect(info.currentResales_).to.equal(0);
      expect(info.maxResales_).to.equal(3);
      expect(info.originalPrice_).to.equal(ethers.parseEther("0.1"));
      expect(info.maxPriceDeviationBps_).to.equal(2000);
    });

    it("should only allow marketplace to increment resale count", async function () {
      await addResaleTier("VIP", "0.1", 100, 5, 0);
      await mintTo(seller, 0, "0.1");

      await expect(
        ticket.connect(seller).incrementResaleCount(1)
      ).to.be.revertedWith("Only marketplace");
    });

    it("should store zero mint price for free tickets", async function () {
      await addResaleTier("Free", "0", 100, 5, 0);
      await mintTo(seller, 0, "0");

      expect(await ticket.originalMintPrice(1)).to.equal(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Listing
  // ═══════════════════════════════════════════════════════════════

  describe("Listing", function () {
    beforeEach(async function () {
      // Tier: 0.1 ETH, max 5 resales, ±10% price deviation
      await addResaleTier("General", "0.1", 100, 5, 1000);
      await mintTo(seller, 0, "0.1");
    });

    it("should list a ticket for resale (escrow-based)", async function () {
      await expect(listTicket(seller, 1, "0.1"))
        .to.emit(marketplace, "TicketListed")
        .withArgs(
          0,
          seller.address,
          await ticket.getAddress(),
          1,
          ethers.parseEther("0.1"),
          ethers.parseEther("0.1")
        );

      // NFT should be held by marketplace
      expect(await ticket.ownerOf(1)).to.equal(await marketplace.getAddress());

      // Listing data
      const listing = await marketplace.getListing(0);
      expect(listing.seller_).to.equal(seller.address);
      expect(listing.askingPrice_).to.equal(ethers.parseEther("0.1"));
      expect(listing.active_).to.be.true;
    });

    it("should track listing count", async function () {
      await listTicket(seller, 1, "0.1");
      expect(await marketplace.listingCount()).to.equal(1);
    });

    it("should mark ticket as listed", async function () {
      await listTicket(seller, 1, "0.1");
      expect(
        await marketplace.isTicketListed(await ticket.getAddress(), 1)
      ).to.be.true;
    });

    it("should return active listing for token", async function () {
      await listTicket(seller, 1, "0.1");
      expect(
        await marketplace.getActiveListingForToken(await ticket.getAddress(), 1)
      ).to.equal(0);
    });

    it("should reject listing from non-owner", async function () {
      await ticket.connect(seller).approve(await marketplace.getAddress(), 1);
      await expect(
        marketplace.connect(buyer).listTicket(
          await ticket.getAddress(),
          1,
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Not the ticket owner");
    });

    it("should reject listing without approval", async function () {
      await expect(
        marketplace.connect(seller).listTicket(
          await ticket.getAddress(),
          1,
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Marketplace not approved");
    });

    it("should reject listing on disallowed contract", async function () {
      await marketplace.setAllowedContract(await ticket.getAddress(), false);
      await ticket.connect(seller).approve(await marketplace.getAddress(), 1);

      await expect(
        marketplace.connect(seller).listTicket(
          await ticket.getAddress(),
          1,
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Contract not allowed");
    });

    it("should reject double listing of same ticket", async function () {
      await listTicket(seller, 1, "0.1");

      // Try to list again — seller no longer owns it (it's in escrow)
      await expect(
        marketplace.connect(seller).listTicket(
          await ticket.getAddress(),
          1,
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Not the ticket owner");
    });

    it("should reject listing when paused", async function () {
      await marketplace.pause();
      await ticket.connect(seller).approve(await marketplace.getAddress(), 1);

      await expect(
        marketplace.connect(seller).listTicket(
          await ticket.getAddress(),
          1,
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWithCustomError(marketplace, "EnforcedPause");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Price Deviation Enforcement
  // ═══════════════════════════════════════════════════════════════

  describe("Price Deviation", function () {
    beforeEach(async function () {
      // 0.1 ETH, max 5 resales, ±10% = 1000 bps
      await addResaleTier("General", "0.1", 100, 5, 1000);
      await mintTo(seller, 0, "0.1");
    });

    it("should allow listing at original price", async function () {
      await expect(listTicket(seller, 1, "0.1")).to.not.be.reverted;
    });

    it("should allow listing at +10% (max boundary)", async function () {
      // 0.1 + 10% = 0.11
      await expect(listTicket(seller, 1, "0.11")).to.not.be.reverted;
    });

    it("should allow listing at -10% (min boundary)", async function () {
      // 0.1 - 10% = 0.09
      await expect(listTicket(seller, 1, "0.09")).to.not.be.reverted;
    });

    it("should reject listing above +10%", async function () {
      await ticket.connect(seller).approve(await marketplace.getAddress(), 1);
      await expect(
        marketplace.connect(seller).listTicket(
          await ticket.getAddress(),
          1,
          ethers.parseEther("0.12")
        )
      ).to.be.revertedWith("Price outside allowed deviation");
    });

    it("should reject listing below -10%", async function () {
      await ticket.connect(seller).approve(await marketplace.getAddress(), 1);
      await expect(
        marketplace.connect(seller).listTicket(
          await ticket.getAddress(),
          1,
          ethers.parseEther("0.08")
        )
      ).to.be.revertedWith("Price outside allowed deviation");
    });

    it("should return correct allowed price range", async function () {
      const range = await marketplace.getAllowedPriceRange(
        await ticket.getAddress(),
        1
      );
      expect(range.minPrice).to.equal(ethers.parseEther("0.09"));
      expect(range.maxPrice).to.equal(ethers.parseEther("0.11"));
      expect(range.hasDeviation).to.be.true;
    });

    it("should allow any price when deviation is 0 (no cap)", async function () {
      await addResaleTier("Uncapped", "0.1", 100, 5, 0);
      await mintTo(seller, 1, "0.1");

      // List at 100x price
      await expect(listTicket(seller, 2, "10.0")).to.not.be.reverted;
    });

    it("should return no deviation for uncapped tiers", async function () {
      await addResaleTier("Uncapped", "0.1", 100, 5, 0);
      await mintTo(seller, 1, "0.1");

      const range = await marketplace.getAllowedPriceRange(
        await ticket.getAddress(),
        2
      );
      expect(range.hasDeviation).to.be.false;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Resale Limit Enforcement
  // ═══════════════════════════════════════════════════════════════

  describe("Resale Limits", function () {
    it("should enforce max 2 resales", async function () {
      // Tier: max 2 resales, no price cap
      await addResaleTier("Limited", "0.1", 100, 2, 0);
      await mintTo(seller, 0, "0.1");

      // Resale 1: seller → buyer
      await listTicket(seller, 1, "0.1");
      await marketplace.connect(buyer).buyTicket(0, { value: ethers.parseEther("0.1") });
      expect(await ticket.resaleCount(1)).to.equal(1);

      // Resale 2: buyer → buyer2
      await ticket.connect(buyer).approve(await marketplace.getAddress(), 1);
      await marketplace.connect(buyer).listTicket(
        await ticket.getAddress(), 1, ethers.parseEther("0.1")
      );
      await marketplace.connect(buyer2).buyTicket(1, { value: ethers.parseEther("0.1") });
      expect(await ticket.resaleCount(1)).to.equal(2);

      // Resale 3: should be rejected (limit reached)
      await ticket.connect(buyer2).approve(await marketplace.getAddress(), 1);
      await expect(
        marketplace.connect(buyer2).listTicket(
          await ticket.getAddress(), 1, ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Resale limit reached for this ticket");
    });

    it("should allow unlimited resales when maxResales is 0", async function () {
      await addResaleTier("Unlimited", "0.1", 100, 0, 0);
      await mintTo(seller, 0, "0.1");

      // Resale 1
      await listTicket(seller, 1, "0.1");
      await marketplace.connect(buyer).buyTicket(0, { value: ethers.parseEther("0.1") });

      // Resale 2
      await ticket.connect(buyer).approve(await marketplace.getAddress(), 1);
      await marketplace.connect(buyer).listTicket(
        await ticket.getAddress(), 1, ethers.parseEther("0.1")
      );
      await marketplace.connect(buyer2).buyTicket(1, { value: ethers.parseEther("0.1") });

      // Should all succeed
      expect(await ticket.resaleCount(1)).to.equal(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Buying
  // ═══════════════════════════════════════════════════════════════

  describe("Buying", function () {
    beforeEach(async function () {
      await addResaleTier("General", "1", 100, 5, 1000);
      await mintTo(seller, 0, "1");
      await listTicket(seller, 1, "1");
    });

    it("should transfer NFT to buyer", async function () {
      await marketplace.connect(buyer).buyTicket(0, { value: ethers.parseEther("1") });
      expect(await ticket.ownerOf(1)).to.equal(buyer.address);
    });

    it("should split payment correctly (seller + platform fee)", async function () {
      const sellerBefore = await ethers.provider.getBalance(seller.address);
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);

      await marketplace.connect(buyer).buyTicket(0, { value: ethers.parseEther("1") });

      const sellerAfter = await ethers.provider.getBalance(seller.address);
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);

      // Platform fee: 1 ETH * 2.5% = 0.025 ETH
      const expectedFee = ethers.parseEther("0.025");
      const expectedProceeds = ethers.parseEther("0.975");

      expect(treasuryAfter - treasuryBefore).to.equal(expectedFee);
      expect(sellerAfter - sellerBefore).to.equal(expectedProceeds);
    });

    it("should increment resale count on purchase", async function () {
      expect(await ticket.resaleCount(1)).to.equal(0);
      await marketplace.connect(buyer).buyTicket(0, { value: ethers.parseEther("1") });
      expect(await ticket.resaleCount(1)).to.equal(1);
    });

    it("should emit TicketSold event", async function () {
      const expectedFee = ethers.parseEther("0.025");
      const expectedProceeds = ethers.parseEther("0.975");

      await expect(
        marketplace.connect(buyer).buyTicket(0, { value: ethers.parseEther("1") })
      )
        .to.emit(marketplace, "TicketSold")
        .withArgs(0, buyer.address, seller.address, ethers.parseEther("1"), expectedFee, expectedProceeds);
    });

    it("should mark listing as inactive after purchase", async function () {
      await marketplace.connect(buyer).buyTicket(0, { value: ethers.parseEther("1") });

      const listing = await marketplace.getListing(0);
      expect(listing.active_).to.be.false;
      expect(
        await marketplace.isTicketListed(await ticket.getAddress(), 1)
      ).to.be.false;
    });

    it("should refund excess payment", async function () {
      const buyerBefore = await ethers.provider.getBalance(buyer.address);

      const tx = await marketplace.connect(buyer).buyTicket(0, { value: ethers.parseEther("2") });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      const buyerAfter = await ethers.provider.getBalance(buyer.address);

      // Buyer should have paid 1 ETH + gas (excess 1 ETH refunded)
      expect(buyerBefore - buyerAfter - gasUsed).to.equal(ethers.parseEther("1"));
    });

    it("should reject insufficient payment", async function () {
      await expect(
        marketplace.connect(buyer).buyTicket(0, { value: ethers.parseEther("0.5") })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("should reject buying own listing", async function () {
      await expect(
        marketplace.connect(seller).buyTicket(0, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Cannot buy own listing");
    });

    it("should reject buying inactive listing", async function () {
      await marketplace.connect(buyer).buyTicket(0, { value: ethers.parseEther("1") });
      await expect(
        marketplace.connect(buyer2).buyTicket(0, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Listing not active");
    });

    it("should reject buying non-existent listing", async function () {
      await expect(
        marketplace.connect(buyer).buyTicket(999, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("Listing does not exist");
    });

    it("should reject buying when paused", async function () {
      await marketplace.pause();
      await expect(
        marketplace.connect(buyer).buyTicket(0, { value: ethers.parseEther("1") })
      ).to.be.revertedWithCustomError(marketplace, "EnforcedPause");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Cancel Listing
  // ═══════════════════════════════════════════════════════════════

  describe("Cancel Listing", function () {
    beforeEach(async function () {
      await addResaleTier("General", "0.1", 100, 5, 0);
      await mintTo(seller, 0, "0.1");
      await listTicket(seller, 1, "0.1");
    });

    it("should return NFT to seller on cancel", async function () {
      await marketplace.connect(seller).cancelListing(0);

      expect(await ticket.ownerOf(1)).to.equal(seller.address);
      expect(
        await marketplace.isTicketListed(await ticket.getAddress(), 1)
      ).to.be.false;
    });

    it("should emit ListingCancelled event", async function () {
      await expect(marketplace.connect(seller).cancelListing(0))
        .to.emit(marketplace, "ListingCancelled")
        .withArgs(0, seller.address);
    });

    it("should mark listing as inactive", async function () {
      await marketplace.connect(seller).cancelListing(0);
      const listing = await marketplace.getListing(0);
      expect(listing.active_).to.be.false;
    });

    it("should allow re-listing after cancel", async function () {
      await marketplace.connect(seller).cancelListing(0);

      // Re-list
      await listTicket(seller, 1, "0.1");
      expect(await marketplace.listingCount()).to.equal(2);
      expect(
        await marketplace.isTicketListed(await ticket.getAddress(), 1)
      ).to.be.true;
    });

    it("should NOT allow cancel by non-seller", async function () {
      await expect(
        marketplace.connect(buyer).cancelListing(0)
      ).to.be.revertedWith("Not the seller");
    });

    it("should NOT allow canceling inactive listing", async function () {
      await marketplace.connect(seller).cancelListing(0);
      await expect(
        marketplace.connect(seller).cancelListing(0)
      ).to.be.revertedWith("Listing not active");
    });

    it("should NOT allow canceling non-existent listing", async function () {
      await expect(
        marketplace.connect(seller).cancelListing(999)
      ).to.be.revertedWith("Listing does not exist");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Transfer Restriction + Marketplace Bypass
  // ═══════════════════════════════════════════════════════════════

  describe("Transfer Restriction Bypass", function () {
    it("should allow marketplace escrow even when transfers restricted", async function () {
      await addResaleTier("General", "0.1", 100, 5, 0);
      await mintTo(seller, 0, "0.1");

      // Restrict direct transfers
      await ticket.connect(organizer).setTransferRestriction(true);

      // Direct transfer should fail
      await expect(
        ticket.connect(seller).transferFrom(seller.address, buyer.address, 1)
      ).to.be.revertedWith("Transfers are restricted for this event");

      // But marketplace listing should work (transfers to/from marketplace are allowed)
      await listTicket(seller, 1, "0.1");
      expect(await ticket.ownerOf(1)).to.equal(await marketplace.getAddress());

      // And buying should work
      await marketplace.connect(buyer).buyTicket(0, { value: ethers.parseEther("0.1") });
      expect(await ticket.ownerOf(1)).to.equal(buyer.address);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Event Start Time Resale Lock
  // ═══════════════════════════════════════════════════════════════

  describe("Event Start Time Resale Lock", function () {
    it("should allow listing before event start time", async function () {
      const futureTime = (await time.latest()) + 86400; // 24h from now
      await ticket.connect(organizer).setEventStartTime(futureTime);

      await addResaleTier("General", "0.1", 100, 5, 0);
      await mintTo(seller, 0, "0.1");

      // Still before event — listing should succeed
      await expect(listTicket(seller, 1, "0.1")).to.not.be.reverted;
    });

    it("should block listing after event has started", async function () {
      const futureTime = (await time.latest()) + 3600; // 1h from now
      await ticket.connect(organizer).setEventStartTime(futureTime);

      await addResaleTier("General", "0.1", 100, 5, 0);
      await mintTo(seller, 0, "0.1");

      // Advance time past event start
      await time.increaseTo(futureTime + 1);

      // Now listing should be blocked
      await ticket.connect(seller).approve(await marketplace.getAddress(), 1);
      await expect(
        marketplace.connect(seller).listTicket(
          await ticket.getAddress(),
          1,
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Resale locked: event has started");
    });

    it("should still allow buying an existing listing after event starts", async function () {
      const futureTime = (await time.latest()) + 86400;
      await ticket.connect(organizer).setEventStartTime(futureTime);

      await addResaleTier("General", "0.1", 100, 5, 0);
      await mintTo(seller, 0, "0.1");

      // List BEFORE event starts
      await listTicket(seller, 1, "0.1");

      // Advance time past event start
      await time.increaseTo(futureTime + 1);

      // Buying should still work (only new listings are blocked)
      await expect(
        marketplace.connect(buyer).buyTicket(0, { value: ethers.parseEther("0.1") })
      ).to.not.be.reverted;
      expect(await ticket.ownerOf(1)).to.equal(buyer.address);
    });

    it("should not block listing when eventStartTime is 0 (disabled)", async function () {
      // eventStartTime defaults to 0 — no resale lock
      expect(await ticket.eventStartTime()).to.equal(0);

      await addResaleTier("General", "0.1", 100, 5, 0);
      await mintTo(seller, 0, "0.1");

      await expect(listTicket(seller, 1, "0.1")).to.not.be.reverted;
    });

    it("should allow listing again after organizer clears eventStartTime", async function () {
      const futureTime = (await time.latest()) + 3600;
      await ticket.connect(organizer).setEventStartTime(futureTime);

      await addResaleTier("General", "0.1", 100, 5, 0);
      await mintTo(seller, 0, "0.1");

      // Advance past event start
      await time.increaseTo(futureTime + 1);

      // Listing blocked
      await ticket.connect(seller).approve(await marketplace.getAddress(), 1);
      await expect(
        marketplace.connect(seller).listTicket(
          await ticket.getAddress(),
          1,
          ethers.parseEther("0.1")
        )
      ).to.be.revertedWith("Resale locked: event has started");

      // Organizer clears event start time (re-enables resale, e.g. postponed event)
      await ticket.connect(organizer).setEventStartTime(0);

      // Now listing should succeed again
      await expect(listTicket(seller, 1, "0.1")).to.not.be.reverted;
    });

    it("should apply event start time set via factory createEvent", async function () {
      const futureTime = (await time.latest()) + 3600;

      // Create a new event with eventStartTime set
      await factory.connect(organizer).createEvent("Timed Event", "TIME", BASE_URI, futureTime);
      const timedClone = await factory.deployedEvents(1);
      const timedTicket = await ethers.getContractAt("TickETHTicket", timedClone);

      // Set up marketplace for this contract
      await timedTicket.connect(organizer).setApprovedMarketplace(await marketplace.getAddress());
      await marketplace.setAllowedContract(timedClone, true);

      // Add tier and mint
      await timedTicket.connect(organizer).addTier("GA", ethers.parseEther("0.1"), 100, 0, 0, 0, ZERO_BYTES32, 5, 0);
      await timedTicket.connect(seller).mint(0, [], { value: ethers.parseEther("0.1") });

      // Advance past start
      await time.increaseTo(futureTime + 1);

      // Should be blocked
      await timedTicket.connect(seller).approve(await marketplace.getAddress(), 1);
      await expect(
        marketplace.connect(seller).listTicket(timedClone, 1, ethers.parseEther("0.1"))
      ).to.be.revertedWith("Resale locked: event has started");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Free Ticket Resale
  // ═══════════════════════════════════════════════════════════════

  describe("Free Ticket Resale", function () {
    it("should allow listing and selling free tickets", async function () {
      await addResaleTier("Free", "0", 100, 5, 0);
      await mintTo(seller, 0, "0");

      // List free ticket at some price (no deviation cap since original was 0)
      await listTicket(seller, 1, "0.5");

      // Buy it
      await marketplace.connect(buyer).buyTicket(0, { value: ethers.parseEther("0.5") });
      expect(await ticket.ownerOf(1)).to.equal(buyer.address);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Admin Emergency Cancel
  // ═══════════════════════════════════════════════════════════════

  describe("Admin Emergency Cancel", function () {
    it("should allow admin to cancel any listing", async function () {
      await addResaleTier("General", "0.1", 100, 5, 0);
      await mintTo(seller, 0, "0.1");
      await listTicket(seller, 1, "0.1");

      // Admin cancels — NFT returns to original seller
      await marketplace.adminCancelListing(0);
      const listing = await marketplace.getListing(0);
      expect(listing.active_).to.be.false;
      expect(await ticket.ownerOf(1)).to.equal(seller.address);
    });

    it("should NOT allow non-admin to use adminCancelListing", async function () {
      await addResaleTier("General", "0.1", 100, 5, 0);
      await mintTo(seller, 0, "0.1");
      await listTicket(seller, 1, "0.1");

      await expect(
        marketplace.connect(seller).adminCancelListing(0)
      ).to.be.revertedWithCustomError(marketplace, "OwnableUnauthorizedAccount");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Full Resale Workflow (End-to-End)
  // ═══════════════════════════════════════════════════════════════

  describe("Full Resale Workflow", function () {
    it("should support: mint → list → buy → re-list → buy (with limits)", async function () {
      // Tier: 1 ETH, max 3 resales, ±20% deviation
      await addResaleTier("VIP", "1", 100, 3, 2000);

      // 1. Original mint
      await mintTo(seller, 0, "1");
      expect(await ticket.ownerOf(1)).to.equal(seller.address);
      expect(await ticket.originalMintPrice(1)).to.equal(ethers.parseEther("1"));

      // 2. Seller lists at 1.15 ETH (within +20%)
      await listTicket(seller, 1, "1.15");

      // 3. Buyer purchases
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      await marketplace.connect(buyer).buyTicket(0, { value: ethers.parseEther("1.15") });

      // Verify ownership transferred
      expect(await ticket.ownerOf(1)).to.equal(buyer.address);
      expect(await ticket.resaleCount(1)).to.equal(1);

      // Verify platform fee on resale
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      const expectedFee = (ethers.parseEther("1.15") * BigInt(PLATFORM_FEE_BPS)) / 10000n;
      expect(treasuryAfter - treasuryBefore).to.equal(expectedFee);

      // 4. Buyer re-lists at 0.9 ETH (within -20%)
      await ticket.connect(buyer).approve(await marketplace.getAddress(), 1);
      await marketplace.connect(buyer).listTicket(
        await ticket.getAddress(),
        1,
        ethers.parseEther("0.9")
      );

      // 5. Buyer2 purchases
      await marketplace.connect(buyer2).buyTicket(1, { value: ethers.parseEther("0.9") });
      expect(await ticket.ownerOf(1)).to.equal(buyer2.address);
      expect(await ticket.resaleCount(1)).to.equal(2);

      // 6. Check allowed price range is still based on ORIGINAL price
      const range = await marketplace.getAllowedPriceRange(await ticket.getAddress(), 1);
      expect(range.minPrice).to.equal(ethers.parseEther("0.8"));  // 1 - 20%
      expect(range.maxPrice).to.equal(ethers.parseEther("1.2"));  // 1 + 20%
    });
  });
});
