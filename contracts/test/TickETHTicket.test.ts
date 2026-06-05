import { expect } from "chai";
import { ethers, network } from "hardhat";
import { TickETHTicket, TickETHFactory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";

// ── Constants ──
const ZERO_BYTES32 = ethers.ZeroHash;
const PLATFORM_FEE_BPS = 250; // 2.5%

describe("TickETHTicket", function () {
  let implementation: TickETHTicket;
  let factory: TickETHFactory;
  let ticket: TickETHTicket;
  let owner: SignerWithAddress;
  let attendee1: SignerWithAddress;
  let attendee2: SignerWithAddress;
  let attendee3: SignerWithAddress;
  let treasury: SignerWithAddress;

  const EVENT_NAME = "ETH Mumbai 2026";
  const EVENT_SYMBOL = "ETHMUM";
  const BASE_URI = "https://api.ticketh.com/metadata/";

  /** Helper: add a simple public tier with no time/wallet/whitelist restrictions */
  async function addPublicTier(
    name: string,
    priceEth: string,
    supply: number,
    maxResales = 0,
    maxPriceDeviationBps = 0
  ) {
    return ticket.addTier(
      name,
      ethers.parseEther(priceEth),
      supply,
      0,  // startTime
      0,  // endTime
      0,  // maxPerWallet
      ZERO_BYTES32,  // merkleRoot
      maxResales,
      maxPriceDeviationBps
    );
  }

  /** Helper: mint from a public tier */
  async function publicMint(
    signer: SignerWithAddress,
    tierId: number,
    valueEth: string
  ) {
    return ticket
      .connect(signer)
      .mint(tierId, [], { value: ethers.parseEther(valueEth) });
  }

  beforeEach(async function () {
    [owner, attendee1, attendee2, attendee3, treasury] =
      await ethers.getSigners();

    // Deploy implementation
    const TickETHTicketFactory =
      await ethers.getContractFactory("TickETHTicket");
    implementation = await TickETHTicketFactory.deploy();
    await implementation.waitForDeployment();

    // Deploy factory with platform fee
    const TickETHFactoryFactory =
      await ethers.getContractFactory("TickETHFactory");
    factory = await TickETHFactoryFactory.deploy(
      await implementation.getAddress(),
      PLATFORM_FEE_BPS,
      treasury.address
    );
    await factory.waitForDeployment();

    // Create clone via factory (owner = organizer)
    await factory
      .connect(owner)
      .createEvent(EVENT_NAME, EVENT_SYMBOL, BASE_URI, 0);
    const cloneAddress = await factory.deployedEvents(0);
    ticket = await ethers.getContractAt("TickETHTicket", cloneAddress);
  });

  // ═══════════════════════════════════════════════════════════════
  //  Initialization
  // ═══════════════════════════════════════════════════════════════

  describe("Initialization", function () {
    it("should set correct name and symbol", async function () {
      expect(await ticket.name()).to.equal(EVENT_NAME);
      expect(await ticket.symbol()).to.equal(EVENT_SYMBOL);
    });

    it("should set correct owner (organizer)", async function () {
      expect(await ticket.owner()).to.equal(owner.address);
    });

    it("should set platform fee config", async function () {
      expect(await ticket.platformFeeBps()).to.equal(PLATFORM_FEE_BPS);
      expect(await ticket.platformTreasury()).to.equal(treasury.address);
    });

    it("should start with zero minted tickets", async function () {
      expect(await ticket.totalMinted()).to.equal(0);
      expect(await ticket.tierCount()).to.equal(0);
    });

    it("should NOT have transfers restricted by default", async function () {
      expect(await ticket.transfersRestricted()).to.equal(false);
    });

    it("should NOT have metadata locked by default", async function () {
      expect(await ticket.metadataLocked()).to.equal(false);
    });

    it("should NOT allow re-initialization", async function () {
      await expect(
        ticket.initialize(
          EVENT_NAME,
          EVENT_SYMBOL,
          BASE_URI,
          owner.address,
          0,
          ethers.ZeroAddress,
          0
        )
      ).to.be.reverted;
    });

    it("should NOT allow initializing the implementation directly", async function () {
      await expect(
        implementation.initialize(
          EVENT_NAME,
          EVENT_SYMBOL,
          BASE_URI,
          owner.address,
          0,
          ethers.ZeroAddress,
          0
        )
      ).to.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Tier Management
  // ═══════════════════════════════════════════════════════════════

  describe("Tier Management", function () {
    it("should add a simple public tier", async function () {
      await expect(addPublicTier("VIP", "0.1", 100))
        .to.emit(ticket, "TierAdded")
        .withArgs(
          0,
          "VIP",
          ethers.parseEther("0.1"),
          100,
          0,
          0,
          0,
          ZERO_BYTES32
        );

      const tier = await ticket.getTier(0);
      expect(tier.name_).to.equal("VIP");
      expect(tier.price_).to.equal(ethers.parseEther("0.1"));
      expect(tier.maxSupply_).to.equal(100);
      expect(tier.minted_).to.equal(0);
      expect(tier.active_).to.be.true;
      expect(tier.startTime_).to.equal(0);
      expect(tier.endTime_).to.equal(0);
      expect(tier.maxPerWallet_).to.equal(0);
      expect(tier.merkleRoot_).to.equal(ZERO_BYTES32);
      expect(tier.maxResales_).to.equal(0);
      expect(tier.maxPriceDeviationBps_).to.equal(0);
    });

    it("should add tier with time window", async function () {
      const start = (await time.latest()) + 3600; // 1 hour from now
      const end = start + 86400; // 24 hours later

      await ticket.addTier("Early Bird", ethers.parseEther("0.05"), 200, start, end, 0, ZERO_BYTES32, 0, 0);

      const tier = await ticket.getTier(0);
      expect(tier.startTime_).to.equal(start);
      expect(tier.endTime_).to.equal(end);
    });

    it("should add tier with per-wallet limit", async function () {
      await ticket.addTier("General", ethers.parseEther("0.01"), 500, 0, 0, 3, ZERO_BYTES32, 0, 0);

      const tier = await ticket.getTier(0);
      expect(tier.maxPerWallet_).to.equal(3);
    });

    it("should add multiple tiers with sequential IDs", async function () {
      await addPublicTier("General", "0.01", 500);
      await addPublicTier("VIP", "0.1", 100);
      await addPublicTier("VVIP", "0.5", 20);

      expect(await ticket.tierCount()).to.equal(3);
      expect((await ticket.getTier(0)).name_).to.equal("General");
      expect((await ticket.getTier(1)).name_).to.equal("VIP");
      expect((await ticket.getTier(2)).name_).to.equal("VVIP");
    });

    it("should allow a free tier", async function () {
      await addPublicTier("Free Entry", "0", 1000);
      expect((await ticket.getTier(0)).price_).to.equal(0);
    });

    it("should reject zero max supply", async function () {
      await expect(
        ticket.addTier("Invalid", ethers.parseEther("0.1"), 0, 0, 0, 0, ZERO_BYTES32, 0, 0)
      ).to.be.revertedWith("Max supply must be > 0");
    });

    it("should reject endTime <= startTime", async function () {
      const start = (await time.latest()) + 3600;
      await expect(
        ticket.addTier("Bad Times", ethers.parseEther("0.01"), 100, start, start - 100, 0, ZERO_BYTES32, 0, 0)
      ).to.be.revertedWith("End must be after start");
    });

    it("should NOT allow non-owner to add tier", async function () {
      await expect(
        ticket
          .connect(attendee1)
          .addTier("VIP", ethers.parseEther("0.1"), 100, 0, 0, 0, ZERO_BYTES32, 0, 0)
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });

    it("should toggle tier status", async function () {
      await addPublicTier("VIP", "0.1", 100);

      await expect(ticket.setTierStatus(0, false))
        .to.emit(ticket, "TierStatusUpdated")
        .withArgs(0, false);
      expect((await ticket.getTier(0)).active_).to.be.false;

      await ticket.setTierStatus(0, true);
      expect((await ticket.getTier(0)).active_).to.be.true;
    });

    it("should update merkle root for a tier", async function () {
      await addPublicTier("Presale", "0.01", 50);
      const newRoot = ethers.keccak256(ethers.toUtf8Bytes("root"));

      await expect(ticket.setTierMerkleRoot(0, newRoot))
        .to.emit(ticket, "TierMerkleRootUpdated")
        .withArgs(0, newRoot);

      expect((await ticket.getTier(0)).merkleRoot_).to.equal(newRoot);
    });

    it("should NOT allow non-owner to update merkle root", async function () {
      await addPublicTier("General", "0.01", 100);
      await expect(
        ticket.connect(attendee1).setTierMerkleRoot(0, ZERO_BYTES32)
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Minting (Public)
  // ═══════════════════════════════════════════════════════════════

  describe("Minting (Public)", function () {
    beforeEach(async function () {
      await addPublicTier("General", "0.01", 3);
      await addPublicTier("VIP", "0.1", 2);
    });

    it("should mint a ticket with correct payment", async function () {
      await expect(publicMint(attendee1, 0, "0.01"))
        .to.emit(ticket, "TicketMinted")
        .withArgs(
          attendee1.address,
          1,
          0,
          ethers.parseEther("0.01"),
          anyValue
        );

      expect(await ticket.ownerOf(1)).to.equal(attendee1.address);
      expect(await ticket.totalMinted()).to.equal(1);
      expect(await ticket.tokenTier(1)).to.equal(0);
    });

    it("should mint a free ticket", async function () {
      await addPublicTier("Free", "0", 100);

      await expect(
        ticket.connect(attendee1).mint(2, [])
      )
        .to.emit(ticket, "TicketMinted")
        .withArgs(attendee1.address, 1, 2, 0, 0);

      expect(await ticket.ownerOf(1)).to.equal(attendee1.address);
    });

    it("should assign sequential token IDs across tiers", async function () {
      await publicMint(attendee1, 0, "0.01");
      await publicMint(attendee2, 1, "0.1");
      await publicMint(attendee1, 0, "0.01");

      expect(await ticket.ownerOf(1)).to.equal(attendee1.address);
      expect(await ticket.ownerOf(2)).to.equal(attendee2.address);
      expect(await ticket.ownerOf(3)).to.equal(attendee1.address);
      expect(await ticket.tokenTier(1)).to.equal(0);
      expect(await ticket.tokenTier(2)).to.equal(1);
      expect(await ticket.tokenTier(3)).to.equal(0);
    });

    it("should refund excess payment (minus platform fee)", async function () {
      // Pay 0.05 for a 0.01 tier
      await publicMint(attendee1, 0, "0.05");

      // Contract should hold: 0.01 - platformFee(0.01 * 250/10000 = 0.00025) = 0.00975
      const fee = (ethers.parseEther("0.01") * BigInt(PLATFORM_FEE_BPS)) / 10000n;
      const contractBalance = await ethers.provider.getBalance(
        await ticket.getAddress()
      );
      expect(contractBalance).to.equal(ethers.parseEther("0.01") - fee);
    });

    it("should reject insufficient payment", async function () {
      await expect(
        publicMint(attendee1, 0, "0.005")
      ).to.be.revertedWith("Insufficient payment");
    });

    it("should reject minting from sold-out tier", async function () {
      await publicMint(attendee1, 0, "0.01");
      await publicMint(attendee1, 0, "0.01");
      await publicMint(attendee1, 0, "0.01");

      await expect(
        publicMint(attendee1, 0, "0.01")
      ).to.be.revertedWith("Tier sold out");
    });

    it("should reject minting from inactive tier", async function () {
      await ticket.setTierStatus(0, false);

      await expect(
        publicMint(attendee1, 0, "0.01")
      ).to.be.revertedWith("Tier not active");
    });

    it("should reject minting from non-existent tier", async function () {
      await expect(
        publicMint(attendee1, 99, "1")
      ).to.be.revertedWith("Tier does not exist");
    });

    it("should reject minting when paused", async function () {
      await ticket.pause();

      await expect(
        publicMint(attendee1, 0, "0.01")
      ).to.be.revertedWithCustomError(ticket, "EnforcedPause");
    });

    it("should track tier minted count and wallet mints", async function () {
      await publicMint(attendee1, 0, "0.01");
      await publicMint(attendee2, 0, "0.01");

      const tier = await ticket.getTier(0);
      expect(tier.minted_).to.equal(2);
      expect(await ticket.getTierAvailability(0)).to.equal(1);
      expect(await ticket.getWalletMints(attendee1.address, 0)).to.equal(1);
      expect(await ticket.getWalletMints(attendee2.address, 0)).to.equal(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Platform Fee
  // ═══════════════════════════════════════════════════════════════

  describe("Platform Fee", function () {
    it("should send platform fee to treasury on mint", async function () {
      await addPublicTier("VIP", "1", 100); // 1 ETH ticket

      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      await publicMint(attendee1, 0, "1");
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);

      // 2.5% of 1 ETH = 0.025 ETH
      const expectedFee = ethers.parseEther("0.025");
      expect(treasuryAfter - treasuryBefore).to.equal(expectedFee);
    });

    it("should leave organizer revenue minus platform fee", async function () {
      await addPublicTier("VIP", "1", 100);
      await publicMint(attendee1, 0, "1");

      const contractBalance = await ethers.provider.getBalance(
        await ticket.getAddress()
      );
      // 1 ETH - 0.025 ETH (fee) = 0.975 ETH
      expect(contractBalance).to.equal(ethers.parseEther("0.975"));
    });

    it("should NOT charge platform fee on free tickets", async function () {
      await addPublicTier("Free", "0", 100);

      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      await ticket.connect(attendee1).mint(0, []);
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);

      expect(treasuryAfter - treasuryBefore).to.equal(0);
    });

    it("should handle zero-fee factory (no platform cut)", async function () {
      // Deploy factory with 0% fee
      const FactoryF = await ethers.getContractFactory("TickETHFactory");
      const zeroFeeFactory = await FactoryF.deploy(
        await implementation.getAddress(),
        0,
        ethers.ZeroAddress
      );
      await zeroFeeFactory.waitForDeployment();

      await zeroFeeFactory
        .connect(owner)
        .createEvent("Free Factory Event", "FFE", BASE_URI, 0);
      const cloneAddr = await zeroFeeFactory.deployedEvents(0);
      const noFeeTicket = await ethers.getContractAt("TickETHTicket", cloneAddr);

      await noFeeTicket.addTier("General", ethers.parseEther("1"), 100, 0, 0, 0, ZERO_BYTES32, 0, 0);

      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      await noFeeTicket.connect(attendee1).mint(0, [], { value: ethers.parseEther("1") });
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);

      expect(treasuryAfter - treasuryBefore).to.equal(0);

      const contractBalance = await ethers.provider.getBalance(cloneAddr);
      expect(contractBalance).to.equal(ethers.parseEther("1")); // No fee taken
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Tier Time Windows
  // ═══════════════════════════════════════════════════════════════

  describe("Tier Time Windows", function () {
    it("should reject mint before startTime", async function () {
      const start = (await time.latest()) + 3600;
      await ticket.addTier("Early Bird", ethers.parseEther("0.01"), 100, start, 0, 0, ZERO_BYTES32, 0, 0);

      await expect(
        publicMint(attendee1, 0, "0.01")
      ).to.be.revertedWith("Sale not started");
    });

    it("should allow mint after startTime", async function () {
      const start = (await time.latest()) + 3600;
      await ticket.addTier("Early Bird", ethers.parseEther("0.01"), 100, start, 0, 0, ZERO_BYTES32, 0, 0);

      await time.increaseTo(start + 1);

      await expect(publicMint(attendee1, 0, "0.01")).to.not.be.reverted;
    });

    it("should reject mint after endTime", async function () {
      const start = (await time.latest()) + 100;
      const end = start + 3600;
      await ticket.addTier("Flash Sale", ethers.parseEther("0.01"), 100, start, end, 0, ZERO_BYTES32, 0, 0);

      await time.increaseTo(end + 1);

      await expect(
        publicMint(attendee1, 0, "0.01")
      ).to.be.revertedWith("Sale ended");
    });

    it("should allow mint within time window", async function () {
      const start = (await time.latest()) + 100;
      const end = start + 86400;
      await ticket.addTier("Window Sale", ethers.parseEther("0.01"), 100, start, end, 0, ZERO_BYTES32, 0, 0);

      await time.increaseTo(start + 1000);

      await expect(publicMint(attendee1, 0, "0.01")).to.not.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Per-Wallet Mint Limits
  // ═══════════════════════════════════════════════════════════════

  describe("Per-Wallet Mint Limits", function () {
    it("should enforce per-wallet limit", async function () {
      // Max 2 per wallet
      await ticket.addTier("General", ethers.parseEther("0.01"), 100, 0, 0, 2, ZERO_BYTES32, 0, 0);

      await publicMint(attendee1, 0, "0.01");
      await publicMint(attendee1, 0, "0.01");

      await expect(
        publicMint(attendee1, 0, "0.01")
      ).to.be.revertedWith("Wallet mint limit reached");
    });

    it("should track limits per wallet independently", async function () {
      await ticket.addTier("General", ethers.parseEther("0.01"), 100, 0, 0, 2, ZERO_BYTES32, 0, 0);

      await publicMint(attendee1, 0, "0.01");
      await publicMint(attendee1, 0, "0.01");

      // attendee2 should still be able to mint
      await expect(publicMint(attendee2, 0, "0.01")).to.not.be.reverted;
    });

    it("should track limits per tier independently", async function () {
      await ticket.addTier("General", ethers.parseEther("0.01"), 100, 0, 0, 1, ZERO_BYTES32, 0, 0);
      await ticket.addTier("VIP", ethers.parseEther("0.1"), 100, 0, 0, 1, ZERO_BYTES32, 0, 0);

      await publicMint(attendee1, 0, "0.01"); // General — 1/1
      await publicMint(attendee1, 1, "0.1");  // VIP — 1/1

      // Can't mint more General
      await expect(
        publicMint(attendee1, 0, "0.01")
      ).to.be.revertedWith("Wallet mint limit reached");

      // Can't mint more VIP either
      await expect(
        publicMint(attendee1, 1, "0.1")
      ).to.be.revertedWith("Wallet mint limit reached");
    });

    it("should allow unlimited when maxPerWallet = 0", async function () {
      await addPublicTier("Unlimited", "0.01", 1000);

      for (let i = 0; i < 5; i++) {
        await publicMint(attendee1, 0, "0.01");
      }
      expect(await ticket.getWalletMints(attendee1.address, 0)).to.equal(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Merkle Presale Whitelist
  // ═══════════════════════════════════════════════════════════════

  describe("Merkle Presale", function () {
    let merkleTree: any;
    let merkleRoot: string;

    beforeEach(async function () {
      // Build whitelist: attendee1 and attendee2 are whitelisted
      const values = [
        [attendee1.address],
        [attendee2.address],
      ];
      merkleTree = StandardMerkleTree.of(values, ["address"]);
      merkleRoot = merkleTree.root;

      // Add presale tier with merkle root
      await ticket.addTier(
        "Presale",
        ethers.parseEther("0.05"),
        100,
        0,
        0,
        2,
        merkleRoot,
        0,
        0
      );
    });

    it("should allow whitelisted address to mint with valid proof", async function () {
      const proof = merkleTree.getProof([attendee1.address]);

      await expect(
        ticket
          .connect(attendee1)
          .mint(0, proof, { value: ethers.parseEther("0.05") })
      ).to.not.be.reverted;

      expect(await ticket.ownerOf(1)).to.equal(attendee1.address);
    });

    it("should reject non-whitelisted address", async function () {
      // attendee3 is NOT in the whitelist
      const fakeProof = merkleTree.getProof([attendee1.address]);

      await expect(
        ticket
          .connect(attendee3)
          .mint(0, fakeProof, { value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("Invalid whitelist proof");
    });

    it("should reject empty proof when whitelist is set", async function () {
      await expect(
        ticket
          .connect(attendee1)
          .mint(0, [], { value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("Invalid whitelist proof");
    });

    it("should allow public mint when merkle root is cleared", async function () {
      // Organizer opens tier to public
      await ticket.setTierMerkleRoot(0, ZERO_BYTES32);

      // Now attendee3 can mint without proof
      await expect(
        ticket
          .connect(attendee3)
          .mint(0, [], { value: ethers.parseEther("0.05") })
      ).to.not.be.reverted;
    });

    it("should work with multiple whitelisted users", async function () {
      const proof1 = merkleTree.getProof([attendee1.address]);
      const proof2 = merkleTree.getProof([attendee2.address]);

      await ticket
        .connect(attendee1)
        .mint(0, proof1, { value: ethers.parseEther("0.05") });
      await ticket
        .connect(attendee2)
        .mint(0, proof2, { value: ethers.parseEther("0.05") });

      expect(await ticket.ownerOf(1)).to.equal(attendee1.address);
      expect(await ticket.ownerOf(2)).to.equal(attendee2.address);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Check-In
  // ═══════════════════════════════════════════════════════════════

  describe("Check-In", function () {
    beforeEach(async function () {
      await addPublicTier("General", "0.01", 100);
      await publicMint(attendee1, 0, "0.01");
    });

    it("should check in a ticket", async function () {
      await expect(ticket.checkIn(1))
        .to.emit(ticket, "TicketCheckedIn")
        .withArgs(1, attendee1.address, anyValue);

      expect(await ticket.checkedIn(1)).to.be.true;
    });

    it("should reject double check-in", async function () {
      await ticket.checkIn(1);
      await expect(ticket.checkIn(1)).to.be.revertedWith("Already checked in");
    });

    it("should reject check-in by non-owner", async function () {
      await expect(
        ticket.connect(attendee1).checkIn(1)
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });

    it("should reject check-in for non-existent token", async function () {
      await expect(ticket.checkIn(999)).to.be.revertedWith(
        "Token does not exist"
      );
    });

    it("should batch check-in multiple tickets", async function () {
      await publicMint(attendee1, 0, "0.01");
      await publicMint(attendee2, 0, "0.01");

      await ticket.batchCheckIn([1, 2, 3]);

      expect(await ticket.checkedIn(1)).to.be.true;
      expect(await ticket.checkedIn(2)).to.be.true;
      expect(await ticket.checkedIn(3)).to.be.true;
    });

    it("should silently skip invalid tokens in batch", async function () {
      await ticket.checkIn(1);
      await expect(ticket.batchCheckIn([1, 999])).to.not.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Transfer Restrictions
  // ═══════════════════════════════════════════════════════════════

  describe("Transfer Restrictions", function () {
    beforeEach(async function () {
      await addPublicTier("General", "0.01", 100);
      await publicMint(attendee1, 0, "0.01");
    });

    it("should allow transfers by default", async function () {
      await ticket
        .connect(attendee1)
        .transferFrom(attendee1.address, attendee2.address, 1);
      expect(await ticket.ownerOf(1)).to.equal(attendee2.address);
    });

    it("should block transfers when restricted", async function () {
      await ticket.setTransferRestriction(true);

      await expect(
        ticket
          .connect(attendee1)
          .transferFrom(attendee1.address, attendee2.address, 1)
      ).to.be.revertedWith("Transfers are restricted for this event");
    });

    it("should still allow minting when transfers restricted", async function () {
      await ticket.setTransferRestriction(true);
      await expect(publicMint(attendee2, 0, "0.01")).to.not.be.reverted;
      expect(await ticket.ownerOf(2)).to.equal(attendee2.address);
    });

    it("should allow transfers after restriction removed", async function () {
      await ticket.setTransferRestriction(true);
      await ticket.setTransferRestriction(false);

      await ticket
        .connect(attendee1)
        .transferFrom(attendee1.address, attendee2.address, 1);
      expect(await ticket.ownerOf(1)).to.equal(attendee2.address);
    });

    it("should emit event on restriction change", async function () {
      await expect(ticket.setTransferRestriction(true))
        .to.emit(ticket, "TransferRestrictionUpdated")
        .withArgs(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Metadata Lock
  // ═══════════════════════════════════════════════════════════════

  describe("Metadata Lock", function () {
    beforeEach(async function () {
      await addPublicTier("General", "0.01", 100);
      await publicMint(attendee1, 0, "0.01");
    });

    it("should allow setBaseURI before lock", async function () {
      await expect(ticket.setBaseURI("ipfs://QmNew/"))
        .to.emit(ticket, "BaseURIUpdated")
        .withArgs("ipfs://QmNew/");

      expect(await ticket.tokenURI(1)).to.equal("ipfs://QmNew/1");
    });

    it("should lock metadata permanently", async function () {
      await expect(ticket.lockMetadata())
        .to.emit(ticket, "MetadataLockedPermanently");

      expect(await ticket.metadataLocked()).to.be.true;
    });

    it("should reject setBaseURI after lock", async function () {
      await ticket.lockMetadata();

      await expect(
        ticket.setBaseURI("ipfs://hacked/")
      ).to.be.revertedWith("Metadata is permanently locked");
    });

    it("should reject double lock", async function () {
      await ticket.lockMetadata();
      await expect(ticket.lockMetadata()).to.be.revertedWith("Already locked");
    });

    it("should NOT allow non-owner to lock", async function () {
      await expect(
        ticket.connect(attendee1).lockMetadata()
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Event Start Time
  // ═══════════════════════════════════════════════════════════════

  describe("Event Start Time", function () {
    it("should default to 0 (no resale lock)", async function () {
      expect(await ticket.eventStartTime()).to.equal(0);
    });

    it("should be settable at creation via factory", async function () {
      const futureTime = (await time.latest()) + 86400;
      await factory
        .connect(owner)
        .createEvent("Timed Event", "TIMED", BASE_URI, futureTime);
      const cloneAddr = await factory.deployedEvents(1);
      const timedTicket = await ethers.getContractAt("TickETHTicket", cloneAddr);

      expect(await timedTicket.eventStartTime()).to.equal(futureTime);
    });

    it("should allow owner to set event start time", async function () {
      const futureTime = (await time.latest()) + 86400;

      await expect(ticket.setEventStartTime(futureTime))
        .to.emit(ticket, "EventStartTimeUpdated")
        .withArgs(futureTime);

      expect(await ticket.eventStartTime()).to.equal(futureTime);
    });

    it("should allow owner to clear event start time", async function () {
      const futureTime = (await time.latest()) + 86400;
      await ticket.setEventStartTime(futureTime);
      await ticket.setEventStartTime(0);
      expect(await ticket.eventStartTime()).to.equal(0);
    });

    it("should NOT allow non-owner to set event start time", async function () {
      await expect(
        ticket.connect(attendee1).setEventStartTime(12345)
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  URI
  // ═══════════════════════════════════════════════════════════════

  describe("URI", function () {
    beforeEach(async function () {
      await addPublicTier("General", "0.01", 100);
      await publicMint(attendee1, 0, "0.01");
    });

    it("should return correct token URI", async function () {
      expect(await ticket.tokenURI(1)).to.equal(BASE_URI + "1");
    });

    it("should NOT allow non-owner to update URI", async function () {
      await expect(
        ticket.connect(attendee1).setBaseURI("ipfs://hacked/")
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Pause
  // ═══════════════════════════════════════════════════════════════

  describe("Pause", function () {
    it("should allow owner to pause and unpause", async function () {
      await ticket.pause();
      await addPublicTier("General", "0.01", 100);

      await expect(
        publicMint(attendee1, 0, "0.01")
      ).to.be.revertedWithCustomError(ticket, "EnforcedPause");

      await ticket.unpause();

      await expect(publicMint(attendee1, 0, "0.01")).to.not.be.reverted;
    });

    it("should NOT allow non-owner to pause", async function () {
      await expect(
        ticket.connect(attendee1).pause()
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Withdraw
  // ═══════════════════════════════════════════════════════════════

  describe("Withdraw", function () {
    beforeEach(async function () {
      await addPublicTier("General", "1", 100);
      await publicMint(attendee1, 0, "1");
    });

    it("should withdraw organizer revenue (fee already split)", async function () {
      const contractAddr = await ticket.getAddress();
      const expectedRevenue =
        ethers.parseEther("1") -
        (ethers.parseEther("1") * BigInt(PLATFORM_FEE_BPS)) / 10000n;

      expect(await ethers.provider.getBalance(contractAddr)).to.equal(
        expectedRevenue
      );

      await expect(ticket.withdraw())
        .to.emit(ticket, "FundsWithdrawn")
        .withArgs(owner.address, expectedRevenue);

      expect(await ethers.provider.getBalance(contractAddr)).to.equal(0);
    });

    it("should reject withdraw when no funds", async function () {
      await ticket.withdraw();
      await expect(ticket.withdraw()).to.be.revertedWith("No funds to withdraw");
    });

    it("should NOT allow non-owner to withdraw", async function () {
      await expect(
        ticket.connect(attendee1).withdraw()
      ).to.be.revertedWithCustomError(ticket, "OwnableUnauthorizedAccount");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  View Functions
  // ═══════════════════════════════════════════════════════════════

  describe("View Functions", function () {
    beforeEach(async function () {
      await addPublicTier("General", "0.01", 100);
      await publicMint(attendee1, 0, "0.01");
    });

    it("should return ticket info", async function () {
      const info = await ticket.getTicketInfo(1);
      expect(info.owner_).to.equal(attendee1.address);
      expect(info.tierId_).to.equal(0);
      expect(info.checkedIn_).to.be.false;
      expect(info.tierName_).to.equal("General");
    });

    it("should return tier availability", async function () {
      expect(await ticket.getTierAvailability(0)).to.equal(99);
    });

    it("should return wallet mints", async function () {
      expect(await ticket.getWalletMints(attendee1.address, 0)).to.equal(1);
      expect(await ticket.getWalletMints(attendee2.address, 0)).to.equal(0);
    });

    it("should reject getTicketInfo for non-existent token", async function () {
      await expect(ticket.getTicketInfo(999)).to.be.revertedWith(
        "Token does not exist"
      );
    });
  });
});
