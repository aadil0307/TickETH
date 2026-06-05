import {
  Injectable,
  UnauthorizedException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SiweMessage, generateNonce } from 'siwe';
import Redis from 'ioredis';
import { UsersService } from '../users/users.service';
import { JwtPayload } from '../common/interfaces';

@Injectable()
export class AuthService implements OnModuleInit {
  private static readonly NONCE_TTL_SECS = 300; // 5 minutes
  private readonly logger = new Logger(AuthService.name);
  private redis: Redis | null = null;
  // Fallback in-memory store (only when Redis unavailable)
  private readonly noncesFallback = new Map<string, { nonce: string; expiresAt: number }>();

  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    try {
      this.redis = new Redis({
        host: this.config.get<string>('REDIS_HOST', 'localhost'),
        port: this.config.get<number>('REDIS_PORT', 6379),
        password: this.config.get<string>('REDIS_PASSWORD') || undefined,
        keyPrefix: 'ticketh:auth:nonce:',
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
      this.redis.connect().then(() => {
        this.logger.log('Auth nonce Redis connected');
      }).catch((err) => {
        this.logger.warn(`Auth Redis unavailable — using in-memory fallback: ${err.message}`);
      });
    } catch {
      this.logger.warn('Auth Redis unavailable — using in-memory fallback');
      this.redis = null;
    }
  }

  private getReadyRedisClient() {
    return this.redis && this.redis.status === 'ready' ? this.redis : null;
  }

  private async storeNonce(address: string, nonce: string) {
    this.noncesFallback.set(address, {
      nonce,
      expiresAt: Date.now() + AuthService.NONCE_TTL_SECS * 1000,
    });

    const redis = this.getReadyRedisClient();
    if (!redis) {
      return;
    }

    try {
      await redis.set(address, nonce, 'EX', AuthService.NONCE_TTL_SECS);
    } catch (err) {
      this.logger.warn(
        `Failed to store SIWE nonce in Redis, falling back to memory: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async readNonce(address: string): Promise<string | null> {
    const redis = this.getReadyRedisClient();
    if (redis) {
      try {
        const nonce = await redis.get(address);
        if (nonce) {
          return nonce;
        }
      } catch (err) {
        this.logger.warn(
          `Failed to read SIWE nonce from Redis, falling back to memory: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    const entry = this.noncesFallback.get(address);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.noncesFallback.delete(address);
      return null;
    }

    return entry.nonce;
  }

  private async consumeNonce(address: string) {
    this.noncesFallback.delete(address);

    const redis = this.getReadyRedisClient();
    if (!redis) {
      return;
    }

    try {
      await redis.del(address);
    } catch (err) {
      this.logger.warn(
        `Failed to clear SIWE nonce from Redis: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Generate a nonce for SIWE. Keyed by wallet address. */
  async getNonce(walletAddress: string): Promise<{ nonce: string }> {
    const nonce = generateNonce();
    const address = walletAddress.toLowerCase();

    await this.storeNonce(address, nonce);

    return { nonce };
  }

  /** Verify SIWE message + signature → return JWT */
  async verify(message: string, signature: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
    let siweMessage: SiweMessage;
    try {
      siweMessage = new SiweMessage(message);
    } catch {
      throw new UnauthorizedException('Invalid SIWE message format');
    }

    const address = siweMessage.address.toLowerCase();

    // Validate nonce from Redis (or fallback)
    const storedNonce = await this.readNonce(address);

    if (!storedNonce) {
      throw new UnauthorizedException('Nonce not found or expired — call /auth/nonce first');
    }
    if (storedNonce !== siweMessage.nonce) {
      throw new UnauthorizedException('Nonce mismatch');
    }

    // Verify signature
    try {
      await siweMessage.verify({ signature });
    } catch {
      throw new UnauthorizedException('Invalid signature');
    }

    // Consume nonce (single-use)
    await this.consumeNonce(address);

    // Upsert user
    let user = await this.users.findByWallet(address);
    if (!user) {
      user = await this.users.create(address);
      this.logger.log(`New user created: ${address}`);
    }

    // Issue JWT
    const payload: JwtPayload = {
      sub: user.id,
      wallet_address: address,
      user_role: user.role,
      role: 'authenticated',
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, { expiresIn: '30d' });

    return { accessToken, refreshToken, user };
  }

  /** Refresh token — issue a new JWT pair from an existing valid one */
  async refresh(currentUser: JwtPayload): Promise<{ accessToken: string; refreshToken: string }> {
    // Fetch fresh user data (role may have changed)
    const user = await this.users.findById(currentUser.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const payload: JwtPayload = {
      sub: user.id,
      wallet_address: user.wallet_address,
      user_role: user.role,
      role: 'authenticated',
    };

    return {
      accessToken: this.jwt.sign(payload),
      refreshToken: this.jwt.sign(payload, { expiresIn: '30d' }),
    };
  }

  /** Get full user profile for /auth/me */
  async getMe(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
