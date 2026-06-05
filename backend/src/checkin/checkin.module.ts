import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CheckinService } from './checkin.service';
import { CheckinController } from './checkin.controller';
import { CheckinGateway } from './checkin.gateway';
import { TicketsModule } from '../tickets/tickets.module';
import { EventsModule } from '../events/events.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ConfigModule, TicketsModule, EventsModule, AuditModule],
  providers: [CheckinService, CheckinGateway],
  controllers: [CheckinController],
  exports: [CheckinService],
})
export class CheckinModule {}
