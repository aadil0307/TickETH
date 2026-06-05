import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlockchainService } from './blockchain.service';
import { BlockchainController } from './blockchain.controller';
import { ChainListenerService } from './chain-listener.service';
import { EventsModule } from '../events/events.module';
import { TicketsModule } from '../tickets/tickets.module';
import { TicketTiersModule } from '../ticket-tiers/ticket-tiers.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ConfigModule, EventsModule, TicketsModule, TicketTiersModule, AuditModule],
  providers: [BlockchainService, ChainListenerService],
  controllers: [BlockchainController],
  exports: [BlockchainService, ChainListenerService],
})
export class BlockchainModule {}
