// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TickETHFactory
 * @notice Factory contract that deploys minimal proxy (EIP-1167) clones
 *         of TickETHTicket for each new event. Saves gas vs full deployment.
 * @dev Admin deploys this once. Organizers call createEvent() to spawn
 *      their own ticket contract clone. Platform fee config is injected
 *      into each clone at initialization time.
 */

interface ITickETHTicket {
    function initialize(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        address organizer_,
        uint96 platformFeeBps_,
        address platformTreasury_,
        uint256 eventStartTime_
    ) external;
}

contract TickETHFactory is Ownable {
    using Clones for address;

    // ═══════════════════════════════════════════════════════════════
    //  State Variables
    // ═══════════════════════════════════════════════════════════════

    /// @notice Address of the TickETHTicket implementation contract
    address public implementation;

    /// @notice Platform fee in basis points (applied to all new events)
    uint96 public platformFeeBps;

    /// @notice Treasury address that receives platform fees
    address public platformTreasury;

    /// @notice Array of all deployed event contract addresses
    address[] public deployedEvents;

    /// @notice Quick lookup: is this address a TickETH event contract?
    mapping(address => bool) public isDeployedEvent;

    /// @notice Organizer wallet → list of their event contracts
    mapping(address => address[]) public organizerEvents;

    // ═══════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════

    event EventContractDeployed(
        address indexed contractAddress,
        address indexed organizer,
        string name,
        string symbol
    );

    event ImplementationUpdated(
        address indexed oldImplementation,
        address indexed newImplementation
    );

    event PlatformFeeUpdated(uint96 oldBps, uint96 newBps);

    event PlatformTreasuryUpdated(
        address indexed oldTreasury,
        address indexed newTreasury
    );

    // ═══════════════════════════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════════════════════════

    /**
     * @param implementation_    Address of the deployed TickETHTicket implementation
     * @param platformFeeBps_    Platform fee in basis points (max 1000 = 10%)
     * @param platformTreasury_  Address that receives platform fees
     */
    constructor(
        address implementation_,
        uint96 platformFeeBps_,
        address platformTreasury_
    ) Ownable(msg.sender) {
        require(implementation_ != address(0), "Invalid implementation");
        require(platformFeeBps_ <= 1000, "Fee exceeds max 10%");
        if (platformFeeBps_ > 0) {
            require(platformTreasury_ != address(0), "Invalid treasury");
        }

        implementation = implementation_;
        platformFeeBps = platformFeeBps_;
        platformTreasury = platformTreasury_;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Factory Functions
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Creates a new event ticket contract (minimal proxy clone).
     * @param name_            ERC-721 collection name
     * @param symbol_          ERC-721 collection symbol
     * @param baseURI_         Base metadata URI for the event
     * @param eventStartTime_  Unix timestamp when event starts (0 = no resale lock)
     * @return clone           Address of the newly deployed event contract
     * @dev The caller (msg.sender) becomes the organizer/owner of the clone.
     *      Platform fee config is injected from factory state.
     */
    function createEvent(
        string calldata name_,
        string calldata symbol_,
        string calldata baseURI_,
        uint256 eventStartTime_
    ) external returns (address clone) {
        clone = implementation.clone();

        ITickETHTicket(clone).initialize(
            name_,
            symbol_,
            baseURI_,
            msg.sender,
            platformFeeBps,
            platformTreasury,
            eventStartTime_
        );

        deployedEvents.push(clone);
        isDeployedEvent[clone] = true;
        organizerEvents[msg.sender].push(clone);

        emit EventContractDeployed(clone, msg.sender, name_, symbol_);
    }

    /**
     * @notice Creates a new event with a deterministic address (CREATE2).
     * @param name_            ERC-721 collection name
     * @param symbol_          ERC-721 collection symbol
     * @param baseURI_         Base metadata URI for the event
     * @param eventStartTime_  Unix timestamp when event starts (0 = no resale lock)
     * @param salt_            Unique salt for deterministic address generation
     * @return clone           Address of the newly deployed event contract
     * @dev Useful when you need to know the contract address before deployment
     *      (e.g. for pre-generating metadata URIs).
     */
    function createEventDeterministic(
        string calldata name_,
        string calldata symbol_,
        string calldata baseURI_,
        uint256 eventStartTime_,
        bytes32 salt_
    ) external returns (address clone) {
        clone = implementation.cloneDeterministic(salt_);

        ITickETHTicket(clone).initialize(
            name_,
            symbol_,
            baseURI_,
            msg.sender,
            platformFeeBps,
            platformTreasury,
            eventStartTime_
        );

        deployedEvents.push(clone);
        isDeployedEvent[clone] = true;
        organizerEvents[msg.sender].push(clone);

        emit EventContractDeployed(clone, msg.sender, name_, symbol_);
    }

    // ═══════════════════════════════════════════════════════════════
    //  View Functions
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Returns total number of deployed event contracts.
     */
    function getDeployedEventsCount() external view returns (uint256) {
        return deployedEvents.length;
    }

    /**
     * @notice Returns all event contracts created by an organizer.
     */
    function getOrganizerEvents(
        address organizer_
    ) external view returns (address[] memory) {
        return organizerEvents[organizer_];
    }

    /**
     * @notice Predicts the address of a deterministic clone before deployment.
     * @param salt_ The salt that will be used for deployment
     */
    function predictDeterministicAddress(
        bytes32 salt_
    ) external view returns (address) {
        return implementation.predictDeterministicAddress(salt_, address(this));
    }

    // ═══════════════════════════════════════════════════════════════
    //  Admin Functions
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Updates the implementation contract for future clones.
     * @param newImplementation_ Address of the new implementation
     * @dev Existing clones are unaffected — they still delegate to the old impl.
     */
    function updateImplementation(
        address newImplementation_
    ) external onlyOwner {
        require(newImplementation_ != address(0), "Invalid implementation");
        address old = implementation;
        implementation = newImplementation_;
        emit ImplementationUpdated(old, newImplementation_);
    }

    /**
     * @notice Updates the platform fee for future events.
     * @param newFeeBps_ New fee in basis points (max 1000 = 10%)
     * @dev Only affects events created AFTER this change.
     */
    function setPlatformFee(uint96 newFeeBps_) external onlyOwner {
        require(newFeeBps_ <= 1000, "Fee exceeds max 10%");
        uint96 old = platformFeeBps;
        platformFeeBps = newFeeBps_;
        emit PlatformFeeUpdated(old, newFeeBps_);
    }

    /**
     * @notice Updates the platform treasury address for future events.
     * @param newTreasury_ New treasury address
     * @dev Only affects events created AFTER this change.
     */
    function setPlatformTreasury(address newTreasury_) external onlyOwner {
        require(newTreasury_ != address(0), "Invalid treasury");
        address old = platformTreasury;
        platformTreasury = newTreasury_;
        emit PlatformTreasuryUpdated(old, newTreasury_);
    }
}
