import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { QueuesService } from './queues.service';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../common/enums';

@ApiTags('Queues')
@Controller('queues')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class QueuesController {
  constructor(private readonly queues: QueuesService) {}

  @Get('health')
  @ApiOperation({ summary: 'Queue health stats (admin only)' })
  getHealth() {
    return this.queues.getQueueHealth();
  }
}
