import { Module } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceController } from './marketplace.controller';
import { TicketsModule } from '../tickets/tickets.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TicketsModule, AuditModule],
  providers: [MarketplaceService],
  controllers: [MarketplaceController],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
