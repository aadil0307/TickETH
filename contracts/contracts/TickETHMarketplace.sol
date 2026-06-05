// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @title TickETHMarketplace
 * @notice Escrow-based secondary marketplace for TickETH NFT tickets.
 * @dev Enforces per-tier resale limits and price deviation caps.
 *
 *  Flow:
 *  1. Seller approves this contract on the ticket contract (ERC-721 approve)
 *  2. Seller calls listTicket() — NFT is transferred to this contract (escrow)
 *  3. Buyer calls buyTicket() — payment is split, NFT goes to buyer
 *  4. Alternatively, seller calls cancelListing() — NFT returned
 *
 *  Safeguards:
 *  - Max resales per ticket (configurable per tier in TickETHTicket)
 *  - Price deviation cap (± % of original mint price, configurable per tier)
 *  - Platform fee on resale proceeds
 *  - Reentrancy protection on all state-changing functions
 */

interface ITickETHTicketResale {
    function ownerOf(uint256 tokenId) external view returns (address);
    function tokenTier(uint256 tokenId) external view returns (uint256);
    function getResaleInfo(uint256 tokenId)
        external
        view
        returns (
            uint256 currentResales,
            uint256 maxResales,
            uint256 originalPrice,
            uint256 maxPriceDeviationBps
        );
    function incrementResaleCount(uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function getApproved(uint256 tokenId) external view returns (address);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
    function platformFeeBps() external view returns (uint96);
    function platformTreasury() external view returns (address);
    function eventStartTime() external view returns (uint256);
}

contract TickETHMarketplace is Ownable, ReentrancyGuard, Pausable {
    // ═══════════════════════════════════════════════════════════════
    //  Structs
    // ═══════════════════════════════════════════════════════════════

    struct Listing {
        address seller;
        address ticketContract;
        uint256 tokenId;
        uint256 askingPrice;     // Price buyer must pay (in wei)
        uint256 originalPrice;   // Original mint price (snapshot for reference)
        uint256 listedAt;
        bool active;
    }

    // ═══════════════════════════════════════════════════════════════
    //  State Variables
    // ═══════════════════════════════════════════════════════════════

    /// @notice Total number of listings ever created (used as auto-incrementing ID)
    uint256 public listingCount;

    /// @notice Listing ID → Listing data
    mapping(uint256 => Listing) public listings;

    /// @notice (ticketContract, tokenId) → active listing ID (0 if not listed)
    /// @dev We store listingId + 1 so that 0 means "no listing"
    mapping(address => mapping(uint256 => uint256)) private _activeListingId;

    /// @notice Allowed ticket contracts (only registered contracts can be listed)
    mapping(address => bool) public allowedContracts;

    /// @notice Maximum basis points (100% = 10_000)
    uint256 private constant MAX_BPS = 10_000;

    // ═══════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════

    event TicketListed(
        uint256 indexed listingId,
        address indexed seller,
        address indexed ticketContract,
        uint256 tokenId,
        uint256 askingPrice,
        uint256 originalPrice
    );

    event TicketSold(
        uint256 indexed listingId,
        address indexed buyer,
        address indexed seller,
        uint256 salePrice,
        uint256 platformFee,
        uint256 sellerProceeds
    );

    event ListingCancelled(
        uint256 indexed listingId,
        address indexed seller
    );

    event ContractAllowed(address indexed ticketContract, bool allowed);

    // ═══════════════════════════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════════════════════════

    constructor() Ownable(msg.sender) {}

    // ═══════════════════════════════════════════════════════════════
    //  Admin Functions
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Registers or unregisters a ticket contract for marketplace use.
     * @param ticketContract_ Address of the TickETHTicket clone
     * @param allowed_        true = allow listings, false = disallow
     */
    function setAllowedContract(
        address ticketContract_,
        bool allowed_
    ) external onlyOwner {
        require(ticketContract_ != address(0), "Invalid contract");
        allowedContracts[ticketContract_] = allowed_;
        emit ContractAllowed(ticketContract_, allowed_);
    }

    /**
     * @notice Pause the marketplace (emergency stop).
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the marketplace.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════
    //  Listing
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Lists a ticket for resale. The NFT is transferred to this contract (escrow).
     * @param ticketContract_ Address of the TickETHTicket contract
     * @param tokenId_        Token ID to list
     * @param askingPrice_    Desired sale price in wei
     * @return listingId      The ID of the newly created listing
     *
     * @dev Requirements:
     *  - Ticket contract must be in allowedContracts
     *  - Caller must own the ticket
     *  - Ticket must be approved for this contract
     *  - Resale count must be below tier limit
     *  - Asking price must be within tier deviation bounds
     *  - Ticket must not already be listed
     */
    function listTicket(
        address ticketContract_,
        uint256 tokenId_,
        uint256 askingPrice_
    ) external whenNotPaused nonReentrant returns (uint256 listingId) {
        require(allowedContracts[ticketContract_], "Contract not allowed");

        ITickETHTicketResale ticket = ITickETHTicketResale(ticketContract_);

        // ── Event start time resale lock ──
        uint256 evtStart = ticket.eventStartTime();
        if (evtStart > 0 && block.timestamp >= evtStart) {
            revert("Resale locked: event has started");
        }

        // Verify ownership
        require(ticket.ownerOf(tokenId_) == msg.sender, "Not the ticket owner");

        // Verify not already listed
        require(
            _activeListingId[ticketContract_][tokenId_] == 0,
            "Ticket already listed"
        );

        // Verify approval
        require(
            ticket.getApproved(tokenId_) == address(this) ||
            ticket.isApprovedForAll(msg.sender, address(this)),
            "Marketplace not approved"
        );

        // Get resale info from ticket contract
        (
            uint256 currentResales,
            uint256 maxResales,
            uint256 originalPrice,
            uint256 maxPriceDeviationBps
        ) = ticket.getResaleInfo(tokenId_);

        // Check resale limit
        if (maxResales > 0) {
            require(
                currentResales < maxResales,
                "Resale limit reached for this ticket"
            );
        }

        // Check price deviation bounds
        if (maxPriceDeviationBps > 0 && originalPrice > 0) {
            uint256 maxPrice = originalPrice +
                (originalPrice * maxPriceDeviationBps) / MAX_BPS;
            uint256 minPrice;
            if ((originalPrice * maxPriceDeviationBps) / MAX_BPS >= originalPrice) {
                minPrice = 0; // underflow protection
            } else {
                minPrice = originalPrice -
                    (originalPrice * maxPriceDeviationBps) / MAX_BPS;
            }

            require(
                askingPrice_ >= minPrice && askingPrice_ <= maxPrice,
                "Price outside allowed deviation"
            );
        }

        // Transfer NFT to marketplace (escrow)
        ticket.transferFrom(msg.sender, address(this), tokenId_);

        // Create listing
        listingId = listingCount++;
        listings[listingId] = Listing({
            seller: msg.sender,
            ticketContract: ticketContract_,
            tokenId: tokenId_,
            askingPrice: askingPrice_,
            originalPrice: originalPrice,
            listedAt: block.timestamp,
            active: true
        });

        _activeListingId[ticketContract_][tokenId_] = listingId + 1;

        emit TicketListed(
            listingId,
            msg.sender,
            ticketContract_,
            tokenId_,
            askingPrice_,
            originalPrice
        );
    }

    // ═══════════════════════════════════════════════════════════════
    //  Buying
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Purchases a listed ticket. Payment is split between seller and platform.
     * @param listingId_ The listing to purchase
     *
     * @dev Requirements:
     *  - Listing must be active
     *  - Msg.value must match or exceed asking price
     *  - Caller cannot buy their own listing
     *  - Excess payment is refunded
     */
    function buyTicket(
        uint256 listingId_
    ) external payable whenNotPaused nonReentrant {
        require(listingId_ < listingCount, "Listing does not exist");

        Listing storage listing = listings[listingId_];
        require(listing.active, "Listing not active");
        require(msg.sender != listing.seller, "Cannot buy own listing");
        require(msg.value >= listing.askingPrice, "Insufficient payment");

        // Mark listing as sold
        listing.active = false;
        _activeListingId[listing.ticketContract][listing.tokenId] = 0;

        ITickETHTicketResale ticket = ITickETHTicketResale(listing.ticketContract);

        // Calculate platform fee using the ticket contract's fee config
        uint256 platformFee = 0;
        address treasury = ticket.platformTreasury();
        uint96 feeBps = ticket.platformFeeBps();

        if (feeBps > 0 && treasury != address(0) && listing.askingPrice > 0) {
            platformFee = (listing.askingPrice * feeBps) / MAX_BPS;
        }

        uint256 sellerProceeds = listing.askingPrice - platformFee;

        // Transfer NFT from marketplace to buyer
        ticket.transferFrom(address(this), msg.sender, listing.tokenId);

        // Increment resale count on the ticket contract
        ticket.incrementResaleCount(listing.tokenId);

        // Send platform fee to treasury
        if (platformFee > 0) {
            (bool feeSuccess, ) = payable(treasury).call{value: platformFee}("");
            require(feeSuccess, "Platform fee transfer failed");
        }

        // Send proceeds to seller
        if (sellerProceeds > 0) {
            (bool sellerSuccess, ) = payable(listing.seller).call{
                value: sellerProceeds
            }("");
            require(sellerSuccess, "Seller payment failed");
        }

        // Refund excess
        uint256 excess = msg.value - listing.askingPrice;
        if (excess > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: excess}("");
            require(refundSuccess, "Refund failed");
        }

        emit TicketSold(
            listingId_,
            msg.sender,
            listing.seller,
            listing.askingPrice,
            platformFee,
            sellerProceeds
        );
    }

    // ═══════════════════════════════════════════════════════════════
    //  Cancel Listing
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Cancels an active listing and returns the NFT to the seller.
     * @param listingId_ The listing to cancel
     * @dev Only the original seller can cancel.
     */
    function cancelListing(
        uint256 listingId_
    ) external nonReentrant {
        require(listingId_ < listingCount, "Listing does not exist");

        Listing storage listing = listings[listingId_];
        require(listing.active, "Listing not active");
        require(listing.seller == msg.sender, "Not the seller");

        listing.active = false;
        _activeListingId[listing.ticketContract][listing.tokenId] = 0;

        // Return NFT to seller
        ITickETHTicketResale(listing.ticketContract).transferFrom(
            address(this),
            msg.sender,
            listing.tokenId
        );

        emit ListingCancelled(listingId_, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Admin Emergency Cancel
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Admin can cancel any listing in an emergency (e.g. reported scam).
     * @param listingId_ The listing to cancel
     * @dev NFT is returned to the original seller.
     */
    function adminCancelListing(
        uint256 listingId_
    ) external onlyOwner nonReentrant {
        require(listingId_ < listingCount, "Listing does not exist");

        Listing storage listing = listings[listingId_];
        require(listing.active, "Listing not active");

        listing.active = false;
        _activeListingId[listing.ticketContract][listing.tokenId] = 0;

        // Return NFT to original seller
        ITickETHTicketResale(listing.ticketContract).transferFrom(
            address(this),
            listing.seller,
            listing.tokenId
        );

        emit ListingCancelled(listingId_, listing.seller);
    }

    // ═══════════════════════════════════════════════════════════════
    //  View Functions
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Returns the details of a listing.
     */
    function getListing(
        uint256 listingId_
    )
        external
        view
        returns (
            address seller_,
            address ticketContract_,
            uint256 tokenId_,
            uint256 askingPrice_,
            uint256 originalPrice_,
            uint256 listedAt_,
            bool active_
        )
    {
        require(listingId_ < listingCount, "Listing does not exist");
        Listing storage l = listings[listingId_];
        return (
            l.seller,
            l.ticketContract,
            l.tokenId,
            l.askingPrice,
            l.originalPrice,
            l.listedAt,
            l.active
        );
    }

    /**
     * @notice Returns the active listing ID for a specific ticket.
     * @return listingId The listing ID, or reverts if not listed
     */
    function getActiveListingForToken(
        address ticketContract_,
        uint256 tokenId_
    ) external view returns (uint256 listingId) {
        uint256 stored = _activeListingId[ticketContract_][tokenId_];
        require(stored > 0, "Ticket not listed");
        return stored - 1;
    }

    /**
     * @notice Checks whether a ticket is currently listed.
     */
    function isTicketListed(
        address ticketContract_,
        uint256 tokenId_
    ) external view returns (bool) {
        return _activeListingId[ticketContract_][tokenId_] > 0;
    }

    /**
     * @notice Computes the allowed price range for a ticket resale.
     * @return minPrice Minimum asking price
     * @return maxPrice Maximum asking price
     * @return hasDeviation Whether a deviation cap is in effect
     */
    function getAllowedPriceRange(
        address ticketContract_,
        uint256 tokenId_
    )
        external
        view
        returns (uint256 minPrice, uint256 maxPrice, bool hasDeviation)
    {
        ITickETHTicketResale ticket = ITickETHTicketResale(ticketContract_);
        (
            ,
            ,
            uint256 originalPrice,
            uint256 maxPriceDeviationBps
        ) = ticket.getResaleInfo(tokenId_);

        if (maxPriceDeviationBps == 0 || originalPrice == 0) {
            return (0, type(uint256).max, false);
        }

        uint256 deviation = (originalPrice * maxPriceDeviationBps) / MAX_BPS;
        minPrice = deviation >= originalPrice ? 0 : originalPrice - deviation;
        maxPrice = originalPrice + deviation;
        hasDeviation = true;
    }

    // ═══════════════════════════════════════════════════════════════
    //  ERC-721 Receiver (required to receive NFTs)
    // ═══════════════════════════════════════════════════════════════

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
