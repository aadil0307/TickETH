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
import { TicketsService } from './tickets.service';
import { RecordMintDto } from './dto/record-mint.dto';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/interfaces';
import { UserRole } from '../common/enums';

@ApiTags('Tickets')
@Controller('tickets')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Get my tickets' })
  getMyTickets(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.tickets.findByOwner(user.wallet_address, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket by ID' })
  getTicket(@Param('id') id: string) {
    return this.tickets.findById(id);
  }

  @Get('event/:eventId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get tickets for event (organizer)' })
  getEventTickets(
    @Param('eventId') eventId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.tickets.findByEvent(eventId, page, limit);
  }

  @Post('record-mint')
  @ApiOperation({ summary: 'Record a minted ticket (after on-chain confirmation)' })
  recordMint(@Body() dto: RecordMintDto) {
    return this.tickets.recordMint(dto);
  }
}
