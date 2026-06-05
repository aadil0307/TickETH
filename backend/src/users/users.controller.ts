import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  UseGuards,
  Param,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/interfaces';
import { UserRole } from '../common/enums';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.users.findById(user.sub);
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update current user profile' })
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.users.updateProfile(user.sub, dto);
  }

  @Post('push-token')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Register push notification token' })
  async setPushToken(
    @CurrentUser() user: JwtPayload,
    @Body() body: { pushToken: string },
  ) {
    return this.users.setPushToken(user.sub, body.pushToken);
  }

  @Post('assign-volunteer')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Assign volunteer role to a wallet address (organizer/admin)' })
  async assignVolunteer(
    @CurrentUser() user: JwtPayload,
    @Body() body: { walletAddress: string },
  ) {
    return this.users.assignVolunteer(body.walletAddress, user.wallet_address);
  }

  @Post('revoke-volunteer')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke volunteer role from a user (organizer/admin)' })
  async revokeVolunteer(
    @Body() body: { walletAddress: string },
  ) {
    return this.users.revokeVolunteer(body.walletAddress);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID (public profile)' })
  async getUser(@Param('id') id: string) {
    return this.users.findById(id);
  }
}
