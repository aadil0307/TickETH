import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { MintProcessor } from './mint.processor';
import { TicketTiersModule } from '../ticket-tiers/ticket-tiers.module';
import { AuditModule } from '../audit/audit.module';

const redisEnabled = process.env.REDIS_ENABLED !== 'false';

@Module({
  imports: [
    ConfigModule,
    ...(redisEnabled ? [BullModule.registerQueue({ name: 'mint-reconciliation' })] : []),
    TicketTiersModule,
    AuditModule,
  ],
  providers: [
    TicketsService,
    ...(redisEnabled ? [MintProcessor] : []),
  ],
  controllers: [TicketsController],
  exports: [TicketsService],
})
export class TicketsModule {}
