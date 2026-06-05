import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseModule } from './common/supabase/supabase.module';
import { RequestIdMiddleware, SecurityLoggerMiddleware } from './common/middleware';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrganizerRequestsModule } from './organizer-requests/organizer-requests.module';
import { EventsModule } from './events/events.module';
import { TicketTiersModule } from './ticket-tiers/ticket-tiers.module';
import { TicketsModule } from './tickets/tickets.module';
import { CheckinModule } from './checkin/checkin.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { IpfsModule } from './ipfs/ipfs.module';
import { QueuesModule } from './queues/queues.module';
import { UploadsModule } from './uploads/uploads.module';
import { DpdpModule } from './dpdp/dpdp.module';
import { SupportModule } from './support/support.module';
import { HealthController } from './health.controller';

const redisEnabled = process.env.REDIS_ENABLED !== 'false';

@Module({
  imports: [
    // Global config from .env
    ConfigModule.forRoot({ isGlobal: true }),

    // ── Rate Limiting ───────────────────────────────────────
    // Default: 100 requests per 60 seconds per IP
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,   // 1 second
        limit: 10,   // 10 requests per second
      },
      {
        name: 'medium',
        ttl: 60000,  // 1 minute
        limit: 100,  // 100 requests per minute
      },
      {
        name: 'long',
        ttl: 3600000, // 1 hour
        limit: 1000,  // 1000 requests per hour
      },
    ]),

    // BullMQ — Redis queue (optional for local dev without Redis)
    ...(redisEnabled
      ? [
          BullModule.forRoot({
            connection: {
              host: process.env.REDIS_HOST ?? 'localhost',
              port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
              password: process.env.REDIS_PASSWORD || undefined,
            },
          }),
        ]
      : []),

    // Core modules
    SupabaseModule,
    AuthModule,
    UsersModule,
    OrganizerRequestsModule,
    EventsModule,
    TicketTiersModule,
    TicketsModule,
    CheckinModule,
    AuditModule,
    AdminModule,
    BlockchainModule,
    MarketplaceModule,

    // Phase 3 additions
    IpfsModule,
    ...(redisEnabled ? [QueuesModule] : []),
    UploadsModule,

    // Phase 6: DPDP compliance
    DpdpModule,

    // Phase 7: Support system
    SupportModule,
  ],
  controllers: [HealthController],
  providers: [
    // Apply throttler globally to all routes
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RequestIdMiddleware, SecurityLoggerMiddleware)
      .forRoutes('*');
  }
}
