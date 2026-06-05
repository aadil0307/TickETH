import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/interfaces';
import { UserRole } from '../common/enums';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Platform dashboard stats' })
  getDashboard() {
    return this.admin.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  listUsers(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('role') role?: UserRole,
  ) {
    return this.admin.listUsers(page, limit, role);
  }

  @Patch('users/:id/role')
  @ApiOperation({ summary: 'Change user role' })
  changeRole(
    @Param('id') id: string,
    @Body('role') role: UserRole,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.changeUserRole(id, role, user.sub, user.wallet_address);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Delete user (DPDP compliance)' })
  deleteUser(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.admin.deleteUser(id, user.sub, user.wallet_address);
  }
}
