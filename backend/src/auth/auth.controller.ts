import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { VerifyDto } from './dto/verify.dto';
import { CurrentUser, Public } from '../common/decorators';
import { JwtPayload } from '../common/interfaces';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Get('nonce')
  @Throttle({ medium: { ttl: 60000, limit: 10 } }) // 10 nonce requests / minute
  @ApiOperation({ summary: 'Get a nonce for SIWE sign-in' })
  getNonce(@Query('address') address: string) {
    return this.auth.getNonce(address);
  }

  @Public()
  @Post('verify')
  @Throttle({ medium: { ttl: 60000, limit: 5 } }) // 5 verify attempts / minute
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify SIWE signature and get JWT' })
  verify(@Body() dto: VerifyDto) {
    return this.auth.verify(dto.message, dto.signature);
  }

  @Post('refresh')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh JWT token' })
  refresh(@CurrentUser() user: JwtPayload) {
    return this.auth.refresh(user);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@CurrentUser() user: JwtPayload) {
    return this.auth.getMe(user.sub);
  }
}
