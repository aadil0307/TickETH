// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title TickETHTicket
 * @notice ERC-721 NFT ticket contract for a single event.
 *         Deployed as a minimal proxy (EIP-1167) clone via TickETHFactory.
 * @dev Uses OpenZeppelin upgradeable contracts for initializer pattern.
 *      Each clone represents one event with multiple ticket tiers.
 *
 *  Features:
 *   - Multi-tier ticketing with per-tier pricing and supply
 *   - Tier time windows (startTime / endTime) for staged sales
 *   - Per-wallet mint limits per tier (anti-bot)
 *   - Merkle-proof presale whitelists per tier
 *   - Platform fee split on mint (basis points)
 *   - Transfer restriction toggle (marketplace-aware)
 *   - Per-tier resale limits (maxResales) and price deviation caps (maxPriceDeviationBps)
 *   - On-chain check-in + batch check-in
 *   - Irreversible metadata lock (post-event immutability)
 *   - Pausable + revenue withdrawal
 */
contract TickETHTicket is
    Initializable,
    ERC721Upgradeable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    // ═══════════════════════════════════════════════════════════════
    //  Structs
    // ═══════════════════════════════════════════════════════════════

    struct Tier {
        string name;
        uint256 price;
        uint256 maxSupply;
        uint256 minted;
        bool active;
        uint256 startTime;              // 0 = immediately available
        uint256 endTime;                // 0 = no end time (open until deactivated)
        uint256 maxPerWallet;           // 0 = unlimited
        bytes32 merkleRoot;             // bytes32(0) = public (no whitelist required)
        uint256 maxResales;             // 0 = unlimited resales
        uint256 maxPriceDeviationBps;   // max ±% from original price in bps (0 = no cap)
    }

    // ═══════════════════════════════════════════════════════════════
    //  State Variables
    // ═══════════════════════════════════════════════════════════════

    /// @notice Next token ID to mint (starts at 1)
    uint256 private _nextTokenId;

    /// @notice Base URI for token metadata
    string private _baseTokenURI;

    /// @notice Whether wallet-to-wallet transfers are restricted
    bool public transfersRestricted;

    /// @notice Whether metadata URI is permanently locked
    bool public metadataLocked;

    /// @notice Platform fee in basis points (e.g. 250 = 2.5%)
    uint96 public platformFeeBps;

    /// @notice Address that receives platform fees on each mint
    address public platformTreasury;

    /// @notice Tier ID → Tier data
    mapping(uint256 => Tier) public tiers;

    /// @notice Total number of tiers created
    uint256 public tierCount;

    /// @notice Token ID → Tier ID it belongs to
    mapping(uint256 => uint256) public tokenTier;

    /// @notice Token ID → whether it has been checked in
    mapping(uint256 => bool) public checkedIn;

    /// @notice Total tickets minted across all tiers
    uint256 public totalMinted;

    /// @notice wallet → tierId → number of mints (for per-wallet limits)
    mapping(address => mapping(uint256 => uint256)) public walletTierMints;

    /// @notice Token ID → number of completed resales
    mapping(uint256 => uint256) public resaleCount;

    /// @notice Token ID → original mint price in wei
    mapping(uint256 => uint256) public originalMintPrice;

    /// @notice Approved marketplace contract allowed to facilitate resales
    address public approvedMarketplace;

    /// @notice Event start time (unix timestamp). 0 = not set.
    /// @dev When non-zero, the marketplace blocks new resale listings after this time.
    uint256 public eventStartTime;

    /// @notice Maximum basis points (100% = 10_000)
    uint96 private constant MAX_BPS = 10_000;

    /// @notice Maximum platform fee (10% = 1_000 bps)
    uint96 private constant MAX_PLATFORM_FEE_BPS = 1_000;

    // ═══════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════

    event TicketMinted(
        address indexed to,
        uint256 indexed tokenId,
        uint256 indexed tierId,
        uint256 pricePaid,
        uint256 platformFee
    );

    event TicketCheckedIn(
        uint256 indexed tokenId,
        address indexed owner,
        uint256 timestamp
    );

    event TierAdded(
        uint256 indexed tierId,
        string name,
        uint256 price,
        uint256 maxSupply,
        uint256 startTime,
        uint256 endTime,
        uint256 maxPerWallet,
        bytes32 merkleRoot
    );

    event TierStatusUpdated(uint256 indexed tierId, bool active);

    event TierMerkleRootUpdated(uint256 indexed tierId, bytes32 merkleRoot);

    event TransferRestrictionUpdated(bool restricted);

    event BaseURIUpdated(string newBaseURI);

    event MetadataLockedPermanently();

    event FundsWithdrawn(address indexed to, uint256 amount);

    event ApprovedMarketplaceUpdated(address indexed marketplace);

    event ResaleCountIncremented(uint256 indexed tokenId, uint256 newCount);

    event EventStartTimeUpdated(uint256 newEventStartTime);

    // ═══════════════════════════════════════════════════════════════
    //  Constructor (disable initializers on implementation)
    // ═══════════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Initializer (called once per clone)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Initializes the event ticket contract.
     * @param name_             ERC-721 collection name (e.g. "ETH India 2026")
     * @param symbol_           ERC-721 symbol (e.g. "ETHI")
     * @param baseURI_          Base metadata URI
     * @param organizer_        Address of the event organizer (becomes owner)
     * @param platformFeeBps_   Platform fee in basis points (max 1000 = 10%)
     * @param platformTreasury_ Address that receives platform fees
     * @param eventStartTime_   Unix timestamp when the event starts (0 = no resale lock)
     */
    function initialize(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        address organizer_,
        uint96 platformFeeBps_,
        address platformTreasury_,
        uint256 eventStartTime_
    ) external initializer {
        __ERC721_init(name_, symbol_);
        __Ownable_init(organizer_);
        __Pausable_init();
        __ReentrancyGuard_init();

        require(platformFeeBps_ <= MAX_PLATFORM_FEE_BPS, "Fee exceeds max");
        if (platformFeeBps_ > 0) {
            require(platformTreasury_ != address(0), "Invalid treasury");
        }

        _baseTokenURI = baseURI_;
        _nextTokenId = 1;
        transfersRestricted = false;
        metadataLocked = false;
        platformFeeBps = platformFeeBps_;
        platformTreasury = platformTreasury_;
        eventStartTime = eventStartTime_;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Tier Management (Organizer Only)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Adds a new ticket tier to the event.
     * @param name_                  Tier name (e.g. "General", "VIP")
     * @param price_                 Price in native token (MATIC) in wei
     * @param maxSupply_             Maximum tickets available in this tier
     * @param startTime_             Unix timestamp when sales open (0 = immediate)
     * @param endTime_               Unix timestamp when sales close (0 = no end)
     * @param maxPerWallet_          Max mints per wallet for this tier (0 = unlimited)
     * @param merkleRoot_            Merkle root for whitelist (bytes32(0) = public)
     * @param maxResales_            Max number of resales per ticket (0 = unlimited)
     * @param maxPriceDeviationBps_  Max price deviation from original in bps (0 = no cap)
     */
    function addTier(
        string calldata name_,
        uint256 price_,
        uint256 maxSupply_,
        uint256 startTime_,
        uint256 endTime_,
        uint256 maxPerWallet_,
        bytes32 merkleRoot_,
        uint256 maxResales_,
        uint256 maxPriceDeviationBps_
    ) external onlyOwner {
        require(maxSupply_ > 0, "Max supply must be > 0");
        if (endTime_ > 0) {
            require(endTime_ > startTime_, "End must be after start");
        }

        uint256 tierId = tierCount++;
        tiers[tierId] = Tier({
            name: name_,
            price: price_,
            maxSupply: maxSupply_,
            minted: 0,
            active: true,
            startTime: startTime_,
            endTime: endTime_,
            maxPerWallet: maxPerWallet_,
            merkleRoot: merkleRoot_,
            maxResales: maxResales_,
            maxPriceDeviationBps: maxPriceDeviationBps_
        });

        emit TierAdded(
            tierId,
            name_,
            price_,
            maxSupply_,
            startTime_,
            endTime_,
            maxPerWallet_,
            merkleRoot_
        );
    }

    /**
     * @notice Activates or deactivates a tier.
     * @param tierId_ The tier to update
     * @param active_ Whether the tier should accept new mints
     */
    function setTierStatus(uint256 tierId_, bool active_) external onlyOwner {
        require(tierId_ < tierCount, "Tier does not exist");
        tiers[tierId_].active = active_;
        emit TierStatusUpdated(tierId_, active_);
    }

    /**
     * @notice Updates the Merkle root for a tier (e.g. add more addresses to whitelist).
     * @param tierId_     The tier to update
     * @param merkleRoot_ New Merkle root (bytes32(0) to make public)
     */
    function setTierMerkleRoot(
        uint256 tierId_,
        bytes32 merkleRoot_
    ) external onlyOwner {
        require(tierId_ < tierCount, "Tier does not exist");
        tiers[tierId_].merkleRoot = merkleRoot_;
        emit TierMerkleRootUpdated(tierId_, merkleRoot_);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Minting
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Mints a ticket NFT for the caller.
     * @param tierId_ The tier to mint from
     * @param proof_  Merkle proof (empty array if tier is public)
     * @dev Requires exact or excess payment. Excess is refunded.
     *      Platform fee is split on mint and sent to treasury.
     */
    function mint(
        uint256 tierId_,
        bytes32[] calldata proof_
    ) external payable whenNotPaused nonReentrant {
        require(tierId_ < tierCount, "Tier does not exist");

        Tier storage tier = tiers[tierId_];
        require(tier.active, "Tier not active");
        require(tier.minted < tier.maxSupply, "Tier sold out");
        require(msg.value >= tier.price, "Insufficient payment");

        // ── Time window check ──
        if (tier.startTime > 0) {
            require(block.timestamp >= tier.startTime, "Sale not started");
        }
        if (tier.endTime > 0) {
            require(block.timestamp <= tier.endTime, "Sale ended");
        }

        // ── Per-wallet limit check ──
        if (tier.maxPerWallet > 0) {
            require(
                walletTierMints[msg.sender][tierId_] < tier.maxPerWallet,
                "Wallet mint limit reached"
            );
        }

        // ── Merkle whitelist check ──
        if (tier.merkleRoot != bytes32(0)) {
            bytes32 leaf = keccak256(
                bytes.concat(keccak256(abi.encode(msg.sender)))
            );
            require(
                MerkleProof.verify(proof_, tier.merkleRoot, leaf),
                "Invalid whitelist proof"
            );
        }

        // ── Mint ──
        uint256 tokenId = _nextTokenId++;
        tier.minted++;
        totalMinted++;
        tokenTier[tokenId] = tierId_;
        walletTierMints[msg.sender][tierId_]++;
        originalMintPrice[tokenId] = tier.price;

        _safeMint(msg.sender, tokenId);

        // ── Platform fee split ──
        uint256 platformFee = 0;
        if (platformFeeBps > 0 && platformTreasury != address(0) && tier.price > 0) {
            platformFee = (tier.price * platformFeeBps) / MAX_BPS;
            if (platformFee > 0) {
                (bool feeSuccess, ) = payable(platformTreasury).call{
                    value: platformFee
                }("");
                require(feeSuccess, "Platform fee transfer failed");
            }
        }

        // ── Refund excess payment ──
        uint256 excess = msg.value - tier.price;
        if (excess > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: excess}("");
            require(refundSuccess, "Refund failed");
        }

        emit TicketMinted(msg.sender, tokenId, tierId_, tier.price, platformFee);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Check-In (Organizer / Backend Only)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Marks a single ticket as checked in.
     * @param tokenId_ The ticket token ID
     */
    function checkIn(uint256 tokenId_) external onlyOwner {
        require(_ownerOf(tokenId_) != address(0), "Token does not exist");
        require(!checkedIn[tokenId_], "Already checked in");

        checkedIn[tokenId_] = true;
        emit TicketCheckedIn(tokenId_, ownerOf(tokenId_), block.timestamp);
    }

    /**
     * @notice Batch check-in for multiple tickets (gas-efficient post-event settlement).
     * @param tokenIds_ Array of token IDs to check in
     * @dev Silently skips invalid or already-checked-in tokens.
     */
    function batchCheckIn(uint256[] calldata tokenIds_) external onlyOwner {
        for (uint256 i = 0; i < tokenIds_.length; i++) {
            uint256 tokenId = tokenIds_[i];
            if (_ownerOf(tokenId) != address(0) && !checkedIn[tokenId]) {
                checkedIn[tokenId] = true;
                emit TicketCheckedIn(
                    tokenId,
                    ownerOf(tokenId),
                    block.timestamp
                );
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Transfer Control
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Toggles transfer restriction for the event.
     * @param restricted_ true = block wallet-to-wallet transfers
     */
    function setTransferRestriction(bool restricted_) external onlyOwner {
        transfersRestricted = restricted_;
        emit TransferRestrictionUpdated(restricted_);
    }

    /**
     * @dev Overrides ERC-721 _update to enforce transfer restrictions.
     *      Minting (from == 0x0) and burning (to == 0x0) are always allowed.
     *      Transfers to/from the approved marketplace are always allowed
     *      (even when transfersRestricted is true) to enable escrow-based resale.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow minting and burning unconditionally
        if (from != address(0) && to != address(0)) {
            bool isMarketplaceFlow = approvedMarketplace != address(0) &&
                (from == approvedMarketplace || to == approvedMarketplace);

            if (transfersRestricted && !isMarketplaceFlow) {
                revert("Transfers are restricted for this event");
            }
        }

        return super._update(to, tokenId, auth);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Metadata URI
    // ═══════════════════════════════════════════════════════════════

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    /**
     * @notice Updates the base metadata URI.
     * @param baseURI_ New base URI (e.g. switch from API to pinned IPFS)
     * @dev Reverts if metadata has been permanently locked.
     */
    function setBaseURI(string calldata baseURI_) external onlyOwner {
        require(!metadataLocked, "Metadata is permanently locked");
        _baseTokenURI = baseURI_;
        emit BaseURIUpdated(baseURI_);
    }

    /**
     * @notice Permanently locks the metadata URI. Cannot be undone.
     * @dev Call this after pinning final metadata to IPFS.
     *      Gives attendees confidence their NFT metadata won't change.
     */
    function lockMetadata() external onlyOwner {
        require(!metadataLocked, "Already locked");
        metadataLocked = true;
        emit MetadataLockedPermanently();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Marketplace Integration
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Sets the approved marketplace contract address.
     * @param marketplace_ Address of the marketplace (address(0) to revoke)
     * @dev Only the marketplace can call incrementResaleCount.
     *      Marketplace transfers bypass transfersRestricted.
     */
    function setApprovedMarketplace(address marketplace_) external onlyOwner {
        approvedMarketplace = marketplace_;
        emit ApprovedMarketplaceUpdated(marketplace_);
    }

    /**
     * @notice Sets or updates the event start time.
     * @param eventStartTime_ Unix timestamp when the event starts (0 = disable resale lock)
     * @dev When non-zero, the marketplace will block new resale listings after this time.
     *      Organizer can call this to update the start time before the event begins.
     */
    function setEventStartTime(uint256 eventStartTime_) external onlyOwner {
        eventStartTime = eventStartTime_;
        emit EventStartTimeUpdated(eventStartTime_);
    }

    /**
     * @notice Increments the resale count for a token. Called by marketplace on sale completion.
     * @param tokenId_ The token that was resold
     * @dev Only callable by the approved marketplace contract.
     */
    function incrementResaleCount(uint256 tokenId_) external {
        require(msg.sender == approvedMarketplace, "Only marketplace");
        require(_ownerOf(tokenId_) != address(0), "Token does not exist");

        resaleCount[tokenId_]++;
        emit ResaleCountIncremented(tokenId_, resaleCount[tokenId_]);
    }

    /**
     * @notice Returns resale info for a given token.
     * @param tokenId_ The token to query
     * @return currentResales_        Number of times this ticket has been resold
     * @return maxResales_            Max allowed resales for this ticket's tier (0 = unlimited)
     * @return originalPrice_         The original mint price in wei
     * @return maxPriceDeviationBps_  Max deviation from original price in bps (0 = no cap)
     */
    function getResaleInfo(
        uint256 tokenId_
    )
        external
        view
        returns (
            uint256 currentResales_,
            uint256 maxResales_,
            uint256 originalPrice_,
            uint256 maxPriceDeviationBps_
        )
    {
        require(_ownerOf(tokenId_) != address(0), "Token does not exist");
        uint256 tid = tokenTier[tokenId_];
        Tier storage tier = tiers[tid];
        return (
            resaleCount[tokenId_],
            tier.maxResales,
            originalMintPrice[tokenId_],
            tier.maxPriceDeviationBps
        );
    }

    // ═══════════════════════════════════════════════════════════════
    //  Pause / Unpause
    // ═══════════════════════════════════════════════════════════════

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Withdraw Revenue
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Withdraws all accumulated ticket sale revenue to the organizer.
     * @dev Platform fees have already been split at mint time.
     *      Remaining balance is pure organizer revenue.
     */
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");

        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");

        emit FundsWithdrawn(owner(), balance);
    }

    // ═══════════════════════════════════════════════════════════════
    //  View Functions
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Returns full tier details.
     */
    function getTier(
        uint256 tierId_
    )
        external
        view
        returns (
            string memory name_,
            uint256 price_,
            uint256 maxSupply_,
            uint256 minted_,
            bool active_,
            uint256 startTime_,
            uint256 endTime_,
            uint256 maxPerWallet_,
            bytes32 merkleRoot_,
            uint256 maxResales_,
            uint256 maxPriceDeviationBps_
        )
    {
        require(tierId_ < tierCount, "Tier does not exist");
        Tier storage tier = tiers[tierId_];
        return (
            tier.name,
            tier.price,
            tier.maxSupply,
            tier.minted,
            tier.active,
            tier.startTime,
            tier.endTime,
            tier.maxPerWallet,
            tier.merkleRoot,
            tier.maxResales,
            tier.maxPriceDeviationBps
        );
    }

    /**
     * @notice Returns remaining tickets available in a tier.
     */
    function getTierAvailability(uint256 tierId_) external view returns (uint256) {
        require(tierId_ < tierCount, "Tier does not exist");
        Tier storage tier = tiers[tierId_];
        return tier.maxSupply - tier.minted;
    }

    /**
     * @notice Returns how many tickets a wallet has minted in a specific tier.
     */
    function getWalletMints(
        address wallet_,
        uint256 tierId_
    ) external view returns (uint256) {
        return walletTierMints[wallet_][tierId_];
    }

    /**
     * @notice Returns ticket info for a given token ID.
     */
    function getTicketInfo(
        uint256 tokenId_
    )
        external
        view
        returns (
            address owner_,
            uint256 tierId_,
            bool checkedIn_,
            string memory tierName_
        )
    {
        require(_ownerOf(tokenId_) != address(0), "Token does not exist");
        uint256 tid = tokenTier[tokenId_];
        return (ownerOf(tokenId_), tid, checkedIn[tokenId_], tiers[tid].name);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Fallback
    // ═══════════════════════════════════════════════════════════════

    receive() external payable {}
}
