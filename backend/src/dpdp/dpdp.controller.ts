import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { DpdpService } from './dpdp.service';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/interfaces';
import { UserRole } from '../common/enums';

/**
 * DPDP (Digital Personal Data Protection) Compliance Controller.
 *
 * Provides endpoints required by DPDP Act 2023:
 * - GET  /me/data     → Export all personal data
 * - DELETE /me/data   → Request data deletion / anonymization
 * - GET  /me/consent  → Check consent status
 * - POST /me/consent  → Grant consent
 * - DELETE /me/consent → Revoke consent
 */
@ApiTags('Privacy (DPDP)')
@Controller('privacy')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class DpdpController {
  constructor(private readonly dpdp: DpdpService) {}

  /* ── Data Export ──────────────────────────────────────────── */

  @Get('me/data')
  @ApiOperation({
    summary: 'Export all personal data (DPDP compliance)',
    description:
      'Returns a JSON export of all personal data stored by TickETH for the authenticated user. Includes profile, tickets, events, marketplace history, check-in logs, and audit trail.',
  })
  @ApiResponse({ status: 200, description: 'Personal data export' })
  exportMyData(@CurrentUser() user: JwtPayload) {
    return this.dpdp.exportUserData(user.sub, user.wallet_address);
  }

  /* ── Data Deletion ────────────────────────────────────────── */

  @Delete('me/data')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request data deletion (DPDP compliance)',
    description:
      'Anonymizes all personal data associated with the authenticated user. Profile is anonymized, account is deactivated. On-chain NFT ownership (blockchain) cannot be modified.',
  })
  @ApiResponse({ status: 200, description: 'Data deletion confirmation' })
  deleteMyData(@CurrentUser() user: JwtPayload) {
    return this.dpdp.deleteUserData(user.sub, user.wallet_address);
  }

  /* ── Consent Management ───────────────────────────────────── */

  @Get('me/consent')
  @ApiOperation({ summary: 'Check consent status' })
  getConsent(@CurrentUser() user: JwtPayload) {
    return this.dpdp.getConsentStatus(user.sub);
  }

  @Post('me/consent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Grant privacy consent' })
  grantConsent(@CurrentUser() user: JwtPayload) {
    return this.dpdp.grantConsent(user.sub, user.wallet_address);
  }

  @Delete('me/consent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke privacy consent' })
  revokeConsent(@CurrentUser() user: JwtPayload) {
    return this.dpdp.revokeConsent(user.sub, user.wallet_address);
  }

  /* ── Admin: Data Minimization Audit ───────────────────────── */

  @Get('audit/data-minimization')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Run data minimization audit (admin only)',
    description:
      'Scans the database for unnecessary PII storage patterns and returns recommendations.',
  })
  runAudit() {
    return this.dpdp.runDataMinimizationAudit();
  }
}
