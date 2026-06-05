import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizerRequestsService } from './organizer-requests.service';
import { SubmitRequestDto } from './dto/submit-request.dto';
import { ReviewRequestDto } from './dto/review-request.dto';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/interfaces';
import { UserRole, RequestStatus } from '../common/enums';

@ApiTags('Organizer Requests')
@Controller('organizer-requests')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@ApiBearerAuth()
export class OrganizerRequestsController {
  constructor(private readonly service: OrganizerRequestsService) {}

  @Post()
  @ApiOperation({ summary: 'Submit organizer request' })
  submit(@CurrentUser() user: JwtPayload, @Body() dto: SubmitRequestDto) {
    return this.service.submit(user.sub, user.wallet_address, dto);
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get my organizer requests' })
  getMyRequests(@CurrentUser() user: JwtPayload) {
    return this.service.findByUser(user.sub);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List all requests (admin)' })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: RequestStatus,
  ) {
    return this.service.findAll(page, limit, status);
  }

  @Get('pending')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List pending requests (admin)' })
  findPending(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.service.findPending(page, limit);
  }

  @Patch(':id/review')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve or reject a request (admin)' })
  review(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReviewRequestDto,
  ) {
    return this.service.review(id, user.sub, user.wallet_address, dto);
  }
}
