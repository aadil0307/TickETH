import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CheckinService } from './checkin.service';
import { ScanTicketDto } from './dto/scan-ticket.dto';
import { ConfirmCheckinDto } from './dto/confirm-checkin.dto';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/interfaces';
import { UserRole } from '../common/enums';

@ApiTags('Check-in')
@Controller('checkin')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class CheckinController {
  constructor(private readonly checkin: CheckinService) {}

  @Get('qr/:ticketId')
  @ApiOperation({ summary: 'Generate HMAC-signed QR payload for a ticket' })
  generateQr(
    @Param('ticketId') ticketId: string,
    @Query('eventId') eventId: string,
  ) {
    return this.checkin.generateQrPayload(ticketId, eventId);
  }

  @Post('scan')
  @UseGuards(RolesGuard)
  @Roles(UserRole.VOLUNTEER, UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Step 1: Volunteer scans ticket QR (HMAC-verified)' })
  scan(
    @Body() dto: ScanTicketDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.checkin.scan(dto, user.sub);
  }

  @Post('confirm')
  @ApiOperation({ summary: 'Step 2: Attendee confirms check-in' })
  confirm(@Body() dto: ConfirmCheckinDto) {
    return this.checkin.confirm(dto);
  }

  @Post('offline-sync')
  @UseGuards(RolesGuard)
  @Roles(UserRole.VOLUNTEER, UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Sync batch of offline-collected scans' })
  offlineSync(
    @Body() body: { scans: ScanTicketDto[] },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.checkin.syncOfflineScans(body.scans, user.sub);
  }

  @Get('event/:eventId/count')
  @UseGuards(RolesGuard)
  @Roles(UserRole.VOLUNTEER, UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get live attendee count for an event' })
  async getLiveCount(@Param('eventId') eventId: string) {
    const count = await this.checkin.getLiveCount(eventId);
    return { eventId, count };
  }

  @Get('status/:checkinLogId')
  @ApiOperation({ summary: 'Get status of a check-in log (used for polling)' })
  async getCheckinStatus(@Param('checkinLogId') checkinLogId: string) {
    return this.checkin.getCheckinStatus(checkinLogId);
  }

  @Get('event/:eventId/logs')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get check-in logs for an event' })
  getEventLogs(
    @Param('eventId') eventId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.checkin.getEventLogs(eventId, page, limit);
  }
}
