import { Module } from '@nestjs/common';
import { TicketTiersService } from './ticket-tiers.service';
import { TicketTiersController } from './ticket-tiers.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  providers: [TicketTiersService],
  controllers: [TicketTiersController],
  exports: [TicketTiersService],
})
export class TicketTiersModule {}
