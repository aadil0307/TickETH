import { Module } from '@nestjs/common';
import { DpdpController } from './dpdp.controller';
import { DpdpService } from './dpdp.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [DpdpController],
  providers: [DpdpService],
  exports: [DpdpService],
})
export class DpdpModule {}
