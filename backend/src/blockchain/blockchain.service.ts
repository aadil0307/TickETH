import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { EventsService } from '../events/events.service';
import { TicketTiersService } from '../ticket-tiers/ticket-tiers.service';

// Minimal ABIs — just the functions we need
const FACTORY_ABI = [
  'function createEvent(string name, string symbol, string baseURI, uint256 eventStartTime) returns (address)',
  'function createEventDeterministic(string name, string symbol, string baseURI, uint256 eventStartTime, bytes32 salt) returns (address)',
  'function predictDeterministicAddress(bytes32 salt) view returns (address)',
  'function isDeployedEvent(address) view returns (bool)',
  'event EventContractDeployed(address indexed clone, address indexed organizer, string name, string symbol)',
];

const TICKET_ABI = [
  'function initialize(string name, string symbol, address organizer, uint96 platformFeeBps, address platformTreasury) external',
  'function addTier(string name, uint256 price, uint256 maxSupply, uint256 startTime, uint256 endTime, uint256 maxPerWallet, bytes32 merkleRoot, uint256 maxResales, uint256 maxPriceDeviationBps) external',
  'function tierCount() view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'function totalMinted() view returns (uint256)',
  'function isCheckedIn(uint256 tokenId) view returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
  'event CheckedIn(uint256 indexed tokenId, uint256 timestamp)',
];

@Injectable()
export class BlockchainService implements OnModuleInit {
  private readonly logger = new Logger(BlockchainService.name);
  private provider!: ethers.JsonRpcProvider;
  private wallet!: ethers.Wallet;
  private factory!: ethers.Contract;

  constructor(
    private readonly config: ConfigService,
    private readonly events: EventsService,
    private readonly ticketTiers: TicketTiersService,
  ) {}

  onModuleInit() {
    const chainId = this.config.get<number>('CHAIN_ID', 80002);
    const rpcUrl =
      chainId === 137
        ? this.config.getOrThrow<string>('POLYGON_MAINNET_RPC_URL')
        : this.config.getOrThrow<string>('POLYGON_AMOY_RPC_URL');

    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    const privateKey = this.config.get<string>('DEPLOYER_PRIVATE_KEY');
    if (privateKey) {
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.logger.log(`Blockchain wallet loaded: ${this.wallet.address}`);
    } else {
      this.logger.warn('No DEPLOYER_PRIVATE_KEY set — blockchain writes disabled');
    }

    const factoryAddress = this.config.get<string>('FACTORY_ADDRESS');
    if (factoryAddress) {
      this.factory = new ethers.Contract(factoryAddress, FACTORY_ABI, this.wallet ?? this.provider);
      this.logger.log(`Factory contract: ${factoryAddress}`);
    }

    this.logger.log(`Blockchain service initialized (chain ${chainId})`);
  }

  /** Fetch event data needed for deployment */
  async getEventForDeploy(eventId: string) {
    return this.events.findById(eventId);
  }

  /** Deploy a new event contract via factory */
  async deployEventContract(
    eventId: string,
    name: string,
    symbol: string,
    organizerAddress: string,
    baseURI: string = '',
    eventStartTime: number = 0,
  ): Promise<{ contractAddress: string; txHash: string }> {
    if (!this.wallet) {
      throw new Error('No deployer wallet configured');
    }

    this.logger.log(`Deploying event contract: ${name} (${symbol})`);

    const tx = await this.factory.createEvent(name, symbol, baseURI, eventStartTime);
    const receipt = await tx.wait();

    // Parse EventContractDeployed log
    const iface = new ethers.Interface(FACTORY_ABI);
    let contractAddress = '';
    for (const log of receipt.logs) {
      try {
        const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed && parsed.name === 'EventContractDeployed') {
          contractAddress = parsed.args[0]; // clone address
          break;
        }
      } catch {
        // not our event
      }
    }

    if (!contractAddress) {
      throw new Error('EventCreated event not found in receipt');
    }

    // Update DB with contract address
    await this.events.setContractAddress(
      eventId,
      contractAddress,
      await this.factory.getAddress(),
    );

    this.logger.log(`Event contract deployed: ${contractAddress} (tx: ${receipt.hash})`);

    return { contractAddress, txHash: receipt.hash };
  }

  /** Add tiers on-chain after contract deployment */
  async addTiersOnChain(
    contractAddress: string,
    eventId: string,
  ): Promise<void> {
    if (!this.wallet) {
      throw new Error('No deployer wallet configured');
    }

    const tiers = await this.ticketTiers.findByEvent(eventId);
    if (!tiers || tiers.length === 0) {
      this.logger.warn(`No tiers found for event ${eventId} — skipping on-chain tier setup`);
      return;
    }

    const ticketContract = new ethers.Contract(contractAddress, TICKET_ABI, this.wallet);

    for (const tier of tiers) {
      const priceWei = tier.price_wei ? BigInt(tier.price_wei) : ethers.parseEther(String(tier.price || 0));
      const startTime = tier.start_time ? Math.floor(new Date(tier.start_time).getTime() / 1000) : 0;
      const endTime = tier.end_time ? Math.floor(new Date(tier.end_time).getTime() / 1000) : 0;
      const merkleRoot = tier.merkle_root || ethers.ZeroHash;

      this.logger.log(`Adding tier "${tier.name}" on-chain for ${contractAddress}`);

      const tx = await ticketContract.addTier(
        tier.name,
        priceWei,
        tier.max_supply,
        startTime,
        endTime,
        tier.max_per_wallet || 0,
        merkleRoot,
        tier.max_resales || 0,
        tier.max_price_deviation_bps || 0,
      );
      await tx.wait();

      this.logger.log(`Tier "${tier.name}" added on-chain (tx: ${tx.hash})`);
    }

    this.logger.log(`All ${tiers.length} tier(s) added on-chain for ${contractAddress}`);
  }

  /** Verify ticket ownership on-chain */
  async verifyOwnership(
    contractAddress: string,
    tokenId: number,
    expectedOwner: string,
  ): Promise<boolean> {
    const ticket = new ethers.Contract(contractAddress, TICKET_ABI, this.provider);
    try {
      const owner = await ticket.ownerOf(tokenId);
      return owner.toLowerCase() === expectedOwner.toLowerCase();
    } catch {
      return false; // token doesn't exist or contract error
    }
  }

  /** Check if ticket is checked in on-chain */
  async isCheckedInOnChain(contractAddress: string, tokenId: number): Promise<boolean> {
    const ticket = new ethers.Contract(contractAddress, TICKET_ABI, this.provider);
    try {
      return await ticket.isCheckedIn(tokenId);
    } catch {
      return false;
    }
  }

  /** Get total minted count from contract */
  async getTotalMinted(contractAddress: string): Promise<number> {
    const ticket = new ethers.Contract(contractAddress, TICKET_ABI, this.provider);
    const count = await ticket.totalMinted();
    return Number(count);
  }

  /** Get token metadata URI */
  async getTokenUri(contractAddress: string, tokenId: number): Promise<string> {
    const ticket = new ethers.Contract(contractAddress, TICKET_ABI, this.provider);
    return await ticket.tokenURI(tokenId);
  }

  /** Predict deterministic address */
  async predictAddress(salt: string): Promise<string> {
    return await this.factory.predictDeterministicAddress(salt);
  }

  /** Get current block number */
  async getBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  /** Get chain ID */
  getChainId(): number {
    return this.config.get<number>('CHAIN_ID', 80002);
  }
}
