import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TicketTiersService } from './ticket-tiers.service';
import { CreateTierDto } from './dto/create-tier.dto';
import { UpdateTierDto } from './dto/update-tier.dto';
import { CurrentUser, Roles, Public } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/interfaces';
import { UserRole } from '../common/enums';

@ApiTags('Ticket Tiers')
@Controller('events/:eventId/tiers')
export class TicketTiersController {
  constructor(private readonly tiers: TicketTiersService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Get tiers for an event' })
  findByEvent(@Param('eventId') eventId: string) {
    return this.tiers.findByEvent(eventId);
  }

  @Public()
  @Get('availability')
  @ApiOperation({ summary: 'Get tier availability' })
  getAvailability(@Param('eventId') eventId: string) {
    return this.tiers.getAvailability(eventId);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a tier (organizer)' })
  create(
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTierDto,
  ) {
    return this.tiers.create(eventId, user.sub, dto);
  }

  @Post('batch')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Batch-create tiers (organizer)' })
  createBatch(
    @Param('eventId') eventId: string,
    @CurrentUser() user: JwtPayload,
    @Body() tiers: CreateTierDto[],
  ) {
    return this.tiers.createBatch(eventId, user.sub, tiers);
  }

  @Patch(':tierId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a tier (organizer)' })
  update(
    @Param('tierId') tierId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateTierDto,
  ) {
    return this.tiers.update(tierId, user.sub, dto);
  }
}
