import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { CurrentUser, Roles, Public } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/interfaces';
import { UserRole, SupportTicketStatus } from '../common/enums';
import {
  CreateSupportTicketDto,
  CreateSupportReplyDto,
  UpdateTicketStatusDto,
} from './dto';

@ApiTags('Support')
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  /* ─── Public: FAQ ──────────────────────────────────────── */

  @Get('faq')
  @Public()
  @ApiOperation({ summary: 'List active FAQ items' })
  getFaq() {
    return this.support.listFaq();
  }

  /* ─── Authenticated: User Tickets ──────────────────────── */

  @Post('tickets')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a support ticket' })
  createTicket(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSupportTicketDto,
  ) {
    return this.support.createTicket(user.sub, user.wallet_address, dto);
  }

  @Get('tickets/mine')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my support tickets' })
  getMyTickets(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.support.getMyTickets(user.sub, +page, +limit);
  }

  @Get('tickets/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get support ticket details with replies' })
  getTicket(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.support.getTicketById(id, user.sub, user.user_role);
  }

  @Post('tickets/:id/reply')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reply to a support ticket' })
  addReply(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSupportReplyDto,
  ) {
    return this.support.addReply(id, user.sub, user.user_role, dto);
  }

  /* ─── Admin: Manage All Tickets ────────────────────────── */

  @Get('admin/tickets')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all support tickets (admin/organizer)' })
  listAllTickets(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: SupportTicketStatus,
  ) {
    return this.support.listAllTickets(+page, +limit, status);
  }

  @Patch('admin/tickets/:id/status')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update support ticket status (admin/organizer)' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.support.updateTicketStatus(id, dto.status);
  }
}
