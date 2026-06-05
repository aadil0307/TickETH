import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** ERC-721 compliant metadata */
export interface NftMetadata {
  name: string;
  description: string;
  image: string;
  external_url?: string;
  attributes: Array<{
    trait_type: string;
    value: string | number;
    display_type?: string;
  }>;
}

export interface IpfsUploadResult {
  cid: string;
  gatewayUrl: string;
  ipfsUri: string; // ipfs://Qm...
}

@Injectable()
export class IpfsService implements OnModuleInit {
  private readonly logger = new Logger(IpfsService.name);
  private apiKey!: string;
  private apiSecret!: string;
  private jwt!: string;
  private gateway!: string;
  private readonly PINATA_API = 'https://api.pinata.cloud';
  private static readonly FETCH_TIMEOUT_MS = 30_000;
  private static readonly MAX_RETRIES = 3;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    this.jwt = this.config.get<string>('PINATA_JWT', '');
    this.apiKey = this.config.get<string>('PINATA_API_KEY', '');
    this.apiSecret = this.config.get<string>('PINATA_API_SECRET', '');
    this.gateway = this.config.get<string>(
      'PINATA_GATEWAY',
      'https://gateway.pinata.cloud/ipfs',
    );

    if (!this.jwt && !this.apiKey) {
      this.logger.warn(
        'No PINATA_JWT or PINATA_API_KEY set — IPFS uploads disabled',
      );
    } else {
      this.logger.log('IPFS service initialized (Pinata)');
    }
  }

  /* ── Headers ──────────────────────────────────────────────── */

  private authHeaders(): Record<string, string> {
    if (this.jwt) {
      return { Authorization: `Bearer ${this.jwt}` };
    }
    return {
      pinata_api_key: this.apiKey,
      pinata_secret_api_key: this.apiSecret,
    };
  }

  /* ── Public API ───────────────────────────────────────────── */

  /** Pin arbitrary JSON to IPFS (general use) */
  async pinJson(
    json: Record<string, any>,
    name?: string,
  ): Promise<IpfsUploadResult> {
    this.ensureConfigured();

    const body = {
      pinataContent: json,
      pinataMetadata: { name: name ?? 'ticketh-json' },
      pinataOptions: { cidVersion: 1 },
    };

    const data = await this.fetchWithRetry<{ IpfsHash: string }>(
      `${this.PINATA_API}/pinning/pinJSONToIPFS`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify(body),
      },
      'pinJSON',
    );
    return this.buildResult(data.IpfsHash);
  }

  /** Pin a file (Buffer) to IPFS */
  async pinFile(
    buffer: Buffer,
    fileName: string,
    mimeType = 'application/octet-stream',
  ): Promise<IpfsUploadResult> {
    this.ensureConfigured();

    // Build multipart form using native FormData (Node 18+)
    const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    const formData = new FormData();
    formData.append('file', blob, fileName);
    formData.append(
      'pinataMetadata',
      JSON.stringify({ name: fileName }),
    );
    formData.append(
      'pinataOptions',
      JSON.stringify({ cidVersion: 1 }),
    );

    const data = await this.fetchWithRetry<{ IpfsHash: string }>(
      `${this.PINATA_API}/pinning/pinFileToIPFS`,
      { method: 'POST', headers: { ...this.authHeaders() }, body: formData },
      'pinFile',
    );
    return this.buildResult(data.IpfsHash);
  }

  /** Generate & pin ERC-721 compliant NFT metadata for a ticket */
  async pinTicketMetadata(params: {
    eventName: string;
    tierName: string;
    tokenId: number;
    description?: string;
    imageUri?: string;       // already-pinned image IPFS URI or HTTP URL
    externalUrl?: string;    // e.g. https://ticketh.xyz/ticket/123
    eventDate?: string;      // ISO 8601
    venue?: string;
    city?: string;
    ticketPrice?: string;    // human-readable, e.g. "0.05 MATIC"
    tierIndex?: number;
    maxSupply?: number;
    organizerAddress?: string;
    contractAddress?: string;
  }): Promise<IpfsUploadResult> {
    const optionalAttrs: Array<{ trait_type: string; value?: string | number; display_type?: string }> = [
      { trait_type: 'Event Date', value: params.eventDate },
      { trait_type: 'Venue', value: params.venue },
      { trait_type: 'City', value: params.city },
      { trait_type: 'Price', value: params.ticketPrice },
      { trait_type: 'Tier Index', value: params.tierIndex, display_type: 'number' },
      { trait_type: 'Max Supply', value: params.maxSupply, display_type: 'number' },
    ];

    const attributes: NftMetadata['attributes'] = [
      { trait_type: 'Event', value: params.eventName },
      { trait_type: 'Tier', value: params.tierName },
      { trait_type: 'Token ID', value: params.tokenId, display_type: 'number' },
      ...optionalAttrs.filter((a) => a.value !== undefined && a.value !== null) as NftMetadata['attributes'],
    ];

    const metadata: NftMetadata = {
      name: `${params.eventName} — ${params.tierName} #${params.tokenId}`,
      description:
        params.description ??
        `NFT ticket for ${params.eventName}. Tier: ${params.tierName}. Powered by TickETH.`,
      image: params.imageUri ?? '',
      external_url: params.externalUrl,
      attributes,
    };

    const metadataName = `ticketh-${params.contractAddress ?? 'ticket'}-${params.tokenId}`;
    return this.pinJson(metadata, metadataName);
  }

  /** Unpin a CID from Pinata (cleanup) */
  async unpin(cid: string): Promise<void> {
    this.ensureConfigured();

    const res = await fetch(`${this.PINATA_API}/pinning/unpin/${cid}`, {
      method: 'DELETE',
      headers: { ...this.authHeaders() },
    });

    if (!res.ok && res.status !== 404) {
      const text = await res.text();
      throw new Error(`Pinata unpin failed (${res.status}): ${text}`);
    }
  }

  /** Test Pinata connection */
  async testConnection(): Promise<boolean> {
    try {
      this.ensureConfigured();
      const res = await fetch(
        `${this.PINATA_API}/data/testAuthentication`,
        { headers: { ...this.authHeaders() } },
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  /* ── Helpers ──────────────────────────────────────────────── */

  private buildResult(cid: string): IpfsUploadResult {
    return {
      cid,
      gatewayUrl: `${this.gateway}/${cid}`,
      ipfsUri: `ipfs://${cid}`,
    };
  }

  private ensureConfigured() {
    if (!this.jwt && !this.apiKey) {
      throw new Error(
        'IPFS not configured. Set PINATA_JWT or PINATA_API_KEY + PINATA_API_SECRET in .env',
      );
    }
  }

  /** Fetch with timeout and exponential retry */
  private async fetchWithRetry<T>(url: string, init: RequestInit, label: string): Promise<T> {
    for (let attempt = 1; attempt <= IpfsService.MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), IpfsService.FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(url, { ...init, signal: controller.signal });
        if (res.ok) return (await res.json()) as T;
        const text = await res.text();
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`Pinata ${label} failed (${res.status}): ${text}`);
        }
        this.logger.warn(`Pinata ${label} attempt ${attempt} failed (${res.status})`);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          this.logger.warn(`Pinata ${label} attempt ${attempt} timed out`);
        } else if (attempt === IpfsService.MAX_RETRIES) {
          throw err;
        }
      } finally {
        clearTimeout(timeout);
      }
      if (attempt < IpfsService.MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      }
    }
    throw new Error(`Pinata ${label} failed after ${IpfsService.MAX_RETRIES} attempts`);
  }
}
