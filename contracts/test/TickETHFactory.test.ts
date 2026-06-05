import { expect } from "chai";
import { ethers } from "hardhat";
import { TickETHTicket, TickETHFactory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

const ZERO_BYTES32 = ethers.ZeroHash;
const PLATFORM_FEE_BPS = 250; // 2.5%

describe("TickETHFactory", function () {
  let implementation: TickETHTicket;
  let factory: TickETHFactory;
  let admin: SignerWithAddress;
  let organizer1: SignerWithAddress;
  let organizer2: SignerWithAddress;
  let attendee: SignerWithAddress;
  let treasury: SignerWithAddress;

  beforeEach(async function () {
    [admin, organizer1, organizer2, attendee, treasury] =
      await ethers.getSigners();

    // Deploy implementation
    const TickETHTicketFactory =
      await ethers.getContractFactory("TickETHTicket");
    implementation = await TickETHTicketFactory.deploy();
    await implementation.waitForDeployment();

    // Deploy factory with platform fee config
    const TickETHFactoryFactory =
      await ethers.getContractFactory("TickETHFactory");
    factory = await TickETHFactoryFactory.deploy(
      await implementation.getAddress(),
      PLATFORM_FEE_BPS,
      treasury.address
    );
    await factory.waitForDeployment();
  });

  // ═══════════════════════════════════════════════════════════════
  //  Deployment
  // ═══════════════════════════════════════════════════════════════

  describe("Deployment", function () {
    it("should set correct implementation address", async function () {
      expect(await factory.implementation()).to.equal(
        await implementation.getAddress()
      );
    });

    it("should set deployer as factory owner", async function () {
      expect(await factory.owner()).to.equal(admin.address);
    });

    it("should set platform fee config", async function () {
      expect(await factory.platformFeeBps()).to.equal(PLATFORM_FEE_BPS);
      expect(await factory.platformTreasury()).to.equal(treasury.address);
    });

    it("should start with zero deployed events", async function () {
      expect(await factory.getDeployedEventsCount()).to.equal(0);
    });

    it("should reject zero address implementation", async function () {
      const Factory = await ethers.getContractFactory("TickETHFactory");
      await expect(
        Factory.deploy(ethers.ZeroAddress, 0, ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid implementation");
    });

    it("should reject fee exceeding 10%", async function () {
      const Factory = await ethers.getContractFactory("TickETHFactory");
      await expect(
        Factory.deploy(await implementation.getAddress(), 1001, treasury.address)
      ).to.be.revertedWith("Fee exceeds max 10%");
    });

    it("should reject non-zero fee with zero treasury", async function () {
      const Factory = await ethers.getContractFactory("TickETHFactory");
      await expect(
        Factory.deploy(
          await implementation.getAddress(),
          250,
          ethers.ZeroAddress
        )
      ).to.be.revertedWith("Invalid treasury");
    });

    it("should allow zero fee with zero treasury", async function () {
      const Factory = await ethers.getContractFactory("TickETHFactory");
      const f = await Factory.deploy(
        await implementation.getAddress(),
        0,
        ethers.ZeroAddress
      );
      await f.waitForDeployment();
      expect(await f.platformFeeBps()).to.equal(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Create Event
  // ═══════════════════════════════════════════════════════════════

  describe("Create Event", function () {
    it("should deploy a new event contract clone", async function () {
      const tx = await factory
        .connect(organizer1)
        .createEvent(
          "Concert 2026",
          "CON26",
          "https://api.ticketh.com/metadata/",
          0
        );

      await expect(tx).to.emit(factory, "EventContractDeployed");
      expect(await factory.getDeployedEventsCount()).to.equal(1);
    });

    it("should initialize the clone with platform fee config", async function () {
      await factory
        .connect(organizer1)
        .createEvent("Concert 2026", "CON26", "uri/", 0);

      const cloneAddress = await factory.deployedEvents(0);
      const clone = await ethers.getContractAt("TickETHTicket", cloneAddress);

      expect(await clone.name()).to.equal("Concert 2026");
      expect(await clone.symbol()).to.equal("CON26");
      expect(await clone.owner()).to.equal(organizer1.address);
      expect(await clone.platformFeeBps()).to.equal(PLATFORM_FEE_BPS);
      expect(await clone.platformTreasury()).to.equal(treasury.address);
    });

    it("should set organizer (msg.sender) as clone owner", async function () {
      await factory
        .connect(organizer2)
        .createEvent("Fest 2026", "FEST", "uri/", 0);

      const cloneAddress = await factory.deployedEvents(0);
      const clone = await ethers.getContractAt("TickETHTicket", cloneAddress);
      expect(await clone.owner()).to.equal(organizer2.address);
    });

    it("should track event in isDeployedEvent mapping", async function () {
      await factory.connect(organizer1).createEvent("Event", "EVT", "uri/", 0);

      const cloneAddress = await factory.deployedEvents(0);
      expect(await factory.isDeployedEvent(cloneAddress)).to.be.true;
      expect(await factory.isDeployedEvent(admin.address)).to.be.false;
    });

    it("should track events per organizer", async function () {
      await factory
        .connect(organizer1)
        .createEvent("Event 1", "E1", "uri1/", 0);
      await factory
        .connect(organizer1)
        .createEvent("Event 2", "E2", "uri2/", 0);
      await factory
        .connect(organizer2)
        .createEvent("Event 3", "E3", "uri3/", 0);

      const org1Events = await factory.getOrganizerEvents(organizer1.address);
      const org2Events = await factory.getOrganizerEvents(organizer2.address);

      expect(org1Events.length).to.equal(2);
      expect(org2Events.length).to.equal(1);
    });

    it("should allow anyone to create an event", async function () {
      await expect(
        factory.connect(attendee).createEvent("My Event", "ME", "uri/", 0)
      ).to.not.be.reverted;
    });

    it("should deploy unique clone addresses", async function () {
      await factory
        .connect(organizer1)
        .createEvent("Event 1", "E1", "uri1/", 0);
      await factory
        .connect(organizer1)
        .createEvent("Event 2", "E2", "uri2/", 0);

      const addr1 = await factory.deployedEvents(0);
      const addr2 = await factory.deployedEvents(1);
      expect(addr1).to.not.equal(addr2);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Deterministic Deploy
  // ═══════════════════════════════════════════════════════════════

  describe("Deterministic Deploy", function () {
    it("should deploy to the predicted address", async function () {
      const salt = ethers.keccak256(ethers.toUtf8Bytes("event-1"));
      const predicted = await factory.predictDeterministicAddress(salt);

      await factory
        .connect(organizer1)
        .createEventDeterministic("Concert", "CON", "uri/", 0, salt);

      const cloneAddress = await factory.deployedEvents(0);
      expect(cloneAddress).to.equal(predicted);
    });

    it("should reject duplicate salt", async function () {
      const salt = ethers.keccak256(ethers.toUtf8Bytes("event-1"));

      await factory
        .connect(organizer1)
        .createEventDeterministic("Concert", "CON", "uri/", 0, salt);

      await expect(
        factory
          .connect(organizer2)
          .createEventDeterministic("Concert 2", "CON2", "uri2/", 0, salt)
      ).to.be.reverted;
    });

    it("should allow different salts from the same organizer", async function () {
      const salt1 = ethers.keccak256(ethers.toUtf8Bytes("event-1"));
      const salt2 = ethers.keccak256(ethers.toUtf8Bytes("event-2"));

      await factory
        .connect(organizer1)
        .createEventDeterministic("Event 1", "E1", "uri1/", 0, salt1);
      await factory
        .connect(organizer1)
        .createEventDeterministic("Event 2", "E2", "uri2/", 0, salt2);

      expect(await factory.getDeployedEventsCount()).to.equal(2);
    });

    it("should inject platform fee into deterministic clones", async function () {
      const salt = ethers.keccak256(ethers.toUtf8Bytes("fee-test"));

      await factory
        .connect(organizer1)
        .createEventDeterministic("Fee Event", "FE", "uri/", 0, salt);

      const cloneAddress = await factory.deployedEvents(0);
      const clone = await ethers.getContractAt("TickETHTicket", cloneAddress);

      expect(await clone.platformFeeBps()).to.equal(PLATFORM_FEE_BPS);
      expect(await clone.platformTreasury()).to.equal(treasury.address);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Admin Functions
  // ═══════════════════════════════════════════════════════════════

  describe("Admin", function () {
    it("should allow owner to update implementation", async function () {
      const NewImpl = await ethers.getContractFactory("TickETHTicket");
      const newImpl = await NewImpl.deploy();
      await newImpl.waitForDeployment();

      await expect(
        factory.updateImplementation(await newImpl.getAddress())
      )
        .to.emit(factory, "ImplementationUpdated")
        .withArgs(
          await implementation.getAddress(),
          await newImpl.getAddress()
        );

      expect(await factory.implementation()).to.equal(
        await newImpl.getAddress()
      );
    });

    it("should NOT allow non-owner to update implementation", async function () {
      await expect(
        factory.connect(organizer1).updateImplementation(organizer1.address)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("should reject zero address for new implementation", async function () {
      await expect(
        factory.updateImplementation(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid implementation");
    });

    it("should not affect existing clones when impl updated", async function () {
      await factory
        .connect(organizer1)
        .createEvent("Old Event", "OLD", "uri/", 0);

      const oldClone = await factory.deployedEvents(0);
      const oldEvent = await ethers.getContractAt("TickETHTicket", oldClone);

      // Update implementation
      const NewImpl = await ethers.getContractFactory("TickETHTicket");
      const newImpl = await NewImpl.deploy();
      await newImpl.waitForDeployment();
      await factory.updateImplementation(await newImpl.getAddress());

      // Old clone should still work
      await oldEvent
        .connect(organizer1)
        .addTier("General", 0, 100, 0, 0, 0, ZERO_BYTES32, 0, 0);
      expect(await oldEvent.tierCount()).to.equal(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Platform Fee Admin
  // ═══════════════════════════════════════════════════════════════

  describe("Platform Fee Admin", function () {
    it("should allow owner to update platform fee", async function () {
      await expect(factory.setPlatformFee(500))
        .to.emit(factory, "PlatformFeeUpdated")
        .withArgs(PLATFORM_FEE_BPS, 500);

      expect(await factory.platformFeeBps()).to.equal(500);
    });

    it("should reject fee exceeding 10%", async function () {
      await expect(factory.setPlatformFee(1001)).to.be.revertedWith(
        "Fee exceeds max 10%"
      );
    });

    it("should allow setting fee to zero", async function () {
      await factory.setPlatformFee(0);
      expect(await factory.platformFeeBps()).to.equal(0);
    });

    it("should NOT allow non-owner to update fee", async function () {
      await expect(
        factory.connect(organizer1).setPlatformFee(500)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("should allow owner to update treasury", async function () {
      await expect(factory.setPlatformTreasury(organizer2.address))
        .to.emit(factory, "PlatformTreasuryUpdated")
        .withArgs(treasury.address, organizer2.address);

      expect(await factory.platformTreasury()).to.equal(organizer2.address);
    });

    it("should reject zero address treasury", async function () {
      await expect(
        factory.setPlatformTreasury(ethers.ZeroAddress)
      ).to.be.revertedWith("Invalid treasury");
    });

    it("should NOT allow non-owner to update treasury", async function () {
      await expect(
        factory.connect(organizer1).setPlatformTreasury(organizer1.address)
      ).to.be.revertedWithCustomError(factory, "OwnableUnauthorizedAccount");
    });

    it("should apply new fee to future events only", async function () {
      // Create event with old fee (250 bps)
      await factory.connect(organizer1).createEvent("Old", "OLD", "uri/", 0);
      const oldClone = await factory.deployedEvents(0);
      const oldEvent = await ethers.getContractAt("TickETHTicket", oldClone);

      // Update fee
      await factory.setPlatformFee(500);

      // Create event with new fee (500 bps)
      await factory.connect(organizer1).createEvent("New", "NEW", "uri/", 0);
      const newClone = await factory.deployedEvents(1);
      const newEvent = await ethers.getContractAt("TickETHTicket", newClone);

      expect(await oldEvent.platformFeeBps()).to.equal(250);
      expect(await newEvent.platformFeeBps()).to.equal(500);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  Full End-to-End Workflow
  // ═══════════════════════════════════════════════════════════════

  describe("Full Workflow", function () {
    it("should support: create → tiers → mint (with fee) → check-in → withdraw", async function () {
      // 1. Organizer creates event
      await factory.connect(organizer1).createEvent(
        "ETH India 2026",
        "ETHI",
        "https://api.ticketh.com/metadata/ethindia/",
        0
      );
      const cloneAddress = await factory.deployedEvents(0);
      const eventContract = await ethers.getContractAt(
        "TickETHTicket",
        cloneAddress
      );

      // 2. Add tiers (with per-wallet limit on General)
      await eventContract
        .connect(organizer1)
        .addTier(
          "General",
          ethers.parseEther("0.01"),
          500,
          0, 0,
          5,           // max 5 per wallet
          ZERO_BYTES32,
          0,           // maxResales (unlimited)
          0            // maxPriceDeviationBps (no cap)
        );
      await eventContract
        .connect(organizer1)
        .addTier(
          "VIP",
          ethers.parseEther("0.1"),
          50,
          0, 0,
          2,           // max 2 per wallet
          ZERO_BYTES32,
          0,           // maxResales (unlimited)
          0            // maxPriceDeviationBps (no cap)
        );

      expect(await eventContract.tierCount()).to.equal(2);

      // 3. Attendee mints General ticket
      const treasuryBefore = await ethers.provider.getBalance(treasury.address);
      await eventContract
        .connect(attendee)
        .mint(0, [], { value: ethers.parseEther("0.01") });
      expect(await eventContract.ownerOf(1)).to.equal(attendee.address);

      // 4. Verify platform fee was sent
      const treasuryAfter = await ethers.provider.getBalance(treasury.address);
      const expectedFee =
        (ethers.parseEther("0.01") * BigInt(PLATFORM_FEE_BPS)) / 10000n;
      expect(treasuryAfter - treasuryBefore).to.equal(expectedFee);

      // 5. Attendee mints VIP ticket
      await eventContract
        .connect(attendee)
        .mint(1, [], { value: ethers.parseEther("0.1") });
      expect(await eventContract.ownerOf(2)).to.equal(attendee.address);

      // 6. Organizer checks in General ticket
      await eventContract.connect(organizer1).checkIn(1);
      expect(await eventContract.checkedIn(1)).to.be.true;
      expect(await eventContract.checkedIn(2)).to.be.false;

      // 7. Verify ticket info
      const info = await eventContract.getTicketInfo(1);
      expect(info.owner_).to.equal(attendee.address);
      expect(info.checkedIn_).to.be.true;
      expect(info.tierName_).to.equal("General");

      // 8. Organizer withdraws (revenue minus platform fees)
      const contractBalance = await ethers.provider.getBalance(cloneAddress);
      expect(contractBalance).to.be.gt(0);

      await eventContract.connect(organizer1).withdraw();
      expect(await ethers.provider.getBalance(cloneAddress)).to.equal(0);

      // 9. Lock metadata (post-event)
      await eventContract
        .connect(organizer1)
        .setBaseURI("ipfs://QmFinalCID/");
      await eventContract.connect(organizer1).lockMetadata();

      await expect(
        eventContract.connect(organizer1).setBaseURI("ipfs://hacked/")
      ).to.be.revertedWith("Metadata is permanently locked");

      // 10. Verify totals
      expect(await eventContract.totalMinted()).to.equal(2);
      expect(await eventContract.getWalletMints(attendee.address, 0)).to.equal(1);
      expect(await eventContract.getWalletMints(attendee.address, 1)).to.equal(1);
    });
  });
});
