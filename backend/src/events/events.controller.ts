import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { CurrentUser, Roles, Public } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/interfaces';
import { UserRole } from '../common/enums';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  /* ── Public ───────────────────────────────────────────────── */

  @Public()
  @Get()
  @ApiOperation({ summary: 'List public events' })
  findPublic(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('city') city?: string,
    @Query('search') search?: string,
  ) {
    return this.events.findPublic(page, limit, city, search);
  }

  /* ── Organizer (BEFORE :id to avoid route shadowing) ────── */

  @Get('organizer/mine')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my events (organizer)' })
  getMyEvents(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.events.findByOrganizer(user.sub, page, limit);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  findOne(@Param('id') id: string) {
    return this.events.findById(id);
  }

  /* ── Organizer ────────────────────────────────────────────── */

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create event (organizer)' })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateEventDto) {
    return this.events.create(user.sub, user.wallet_address, dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update event (organizer)' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateEventDto,
  ) {
    return this.events.update(id, user.sub, dto);
  }

  @Post(':id/publish')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Publish event' })
  publish(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.events.publish(id, user.sub, user.wallet_address);
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel event' })
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.events.cancel(id, user.sub, user.wallet_address);
  }

  @Get(':id/stats')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get event stats (organizer dashboard)' })
  getStats(@Param('id') id: string) {
    return this.events.getStats(id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete event (organizer owner or admin)' })
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.events.delete(id, user.sub, user.wallet_address, user.user_role);
  }
}
