import { Module } from '@nestjs/common';
import { OrganizerRequestsService } from './organizer-requests.service';
import { OrganizerRequestsController } from './organizer-requests.controller';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [UsersModule, AuditModule],
  providers: [OrganizerRequestsService],
  controllers: [OrganizerRequestsController],
  exports: [OrganizerRequestsService],
})
export class OrganizerRequestsModule {}
