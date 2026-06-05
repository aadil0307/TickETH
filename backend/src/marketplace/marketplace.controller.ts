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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { MarketplaceService } from './marketplace.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { CompleteSaleDto } from './dto/complete-sale.dto';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/interfaces';
import { UserRole } from '../common/enums';

@ApiTags('Marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplace: MarketplaceService) {}

  // ─── Public: Browse active listings ─────────────────────

  @Get('listings')
  @ApiOperation({ summary: 'Browse active marketplace listings' })
  @ApiQuery({ name: 'eventId', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getActiveListings(
    @Query('eventId') eventId?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.marketplace.findActiveListings(eventId, page, limit);
  }

  @Get('listings/:id')
  @ApiOperation({ summary: 'Get listing by ID' })
  getListing(@Param('id') id: string) {
    return this.marketplace.findListingById(id);
  }

  // ─── Auth: My listings ──────────────────────────────────

  @Get('my-listings')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get my marketplace listings' })
  getMyListings(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.marketplace.findBySellerWallet(user.wallet_address, page, limit);
  }

  // ─── Auth: Create listing ──────────────────────────────

  @Post('list')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List a ticket for resale' })
  createListing(@Body() dto: CreateListingDto) {
    return this.marketplace.createListing(dto);
  }

  // ─── Admin/Service: Complete sale ─────────────────────

  @Post('complete-sale')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Record a completed sale (admin/backend)' })
  completeSale(@Body() dto: CompleteSaleDto) {
    return this.marketplace.completeSale(dto);
  }

  // ─── Auth: Cancel listing ──────────────────────────────

  @Post('cancel/:listingId')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a listing and return ticket' })
  cancelListing(
    @Param('listingId') listingId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.marketplace.cancelListing(listingId, user.wallet_address);
  }

  // ─── Public: Resale history ────────────────────────────

  @Get('history/:ticketId')
  @ApiOperation({ summary: 'Get resale history for a ticket' })
  getResaleHistory(@Param('ticketId') ticketId: string) {
    return this.marketplace.getResaleHistory(ticketId);
  }

  // ─── Organizer/Admin: Marketplace stats ────────────────

  @Get('stats/:eventId')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get marketplace stats for an event' })
  getEventStats(@Param('eventId') eventId: string) {
    return this.marketplace.getEventMarketplaceStats(eventId);
  }
}
