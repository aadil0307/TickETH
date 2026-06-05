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
import { BlockchainService } from './blockchain.service';
import { ChainListenerService } from './chain-listener.service';
import { CurrentUser, Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { JwtPayload } from '../common/interfaces';
import { UserRole } from '../common/enums';

@ApiTags('Blockchain')
@Controller('blockchain')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class BlockchainController {
  constructor(
    private readonly blockchain: BlockchainService,
    private readonly listener: ChainListenerService,
  ) {}

  @Post('deploy')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Deploy event contract via factory' })
  async deploy(
    @Body() dto: { eventId: string; name?: string; symbol?: string; baseURI?: string; eventStartTime?: number },
    @CurrentUser() user: JwtPayload,
  ) {
    // If name/symbol not provided, look up from the event
    const event = (!dto.name || !dto.symbol)
      ? await this.blockchain.getEventForDeploy(dto.eventId)
      : null;
    const name = dto.name || event?.title || 'TickETH Event';
    const symbol = dto.symbol || (event?.title ?? 'TICKT').replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase() || 'TICKT';

    const startTime = dto.eventStartTime ?? 0;

    const result = await this.blockchain.deployEventContract(
      dto.eventId,
      name,
      symbol,
      user.wallet_address,
      dto.baseURI ?? '',
      startTime,
    );

    // Add tiers on-chain so mint() can find them
    await this.blockchain.addTiersOnChain(result.contractAddress, dto.eventId);

    // Auto-register new contract for chain listener monitoring
    this.listener.registerContract(result.contractAddress, dto.eventId);

    return result;
  }

  @Get('verify/:contractAddress/:tokenId')
  @ApiOperation({ summary: 'Verify ticket ownership on-chain' })
  verify(
    @Param('contractAddress') contract: string,
    @Param('tokenId') tokenId: number,
    @Query('owner') owner: string,
  ) {
    return this.blockchain.verifyOwnership(contract, tokenId, owner);
  }

  @Get('status')
  @ApiOperation({ summary: 'Blockchain connection + listener status' })
  async status() {
    const blockNumber = await this.blockchain.getBlockNumber();
    return {
      chainId: this.blockchain.getChainId(),
      blockNumber,
      connected: true,
      listener: this.listener.getStatus(),
    };
  }

  @Post('listener/rescan')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Rescan a block range (admin utility)' })
  async rescan(@Body() dto: { fromBlock: number; toBlock: number }) {
    await this.listener.rescanBlocks(dto.fromBlock, dto.toBlock);
    return { success: true, message: `Rescanned blocks ${dto.fromBlock}–${dto.toBlock}` };
  }
}
