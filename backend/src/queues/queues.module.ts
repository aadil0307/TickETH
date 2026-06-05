import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationProcessor } from './notification.processor';
import { AnalyticsProcessor } from './analytics.processor';
import { QueuesService } from './queues.service';
import { QueuesController } from './queues.controller';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'notifications' },
      { name: 'analytics' },
    ),
  ],
  providers: [
    NotificationProcessor,
    AnalyticsProcessor,
    QueuesService,
  ],
  controllers: [QueuesController],
  exports: [QueuesService],
})
export class QueuesModule {}
