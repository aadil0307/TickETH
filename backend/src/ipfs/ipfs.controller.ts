import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { IpfsService } from './ipfs.service';
import { Roles } from '../common/decorators';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../common/enums';
import { PinMetadataDto } from './dto/pin-metadata.dto';

@ApiTags('IPFS')
@Controller('ipfs')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class IpfsController {
  constructor(private readonly ipfs: IpfsService) {}

  @Post('pin-metadata')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Pin NFT ticket metadata to IPFS' })
  async pinMetadata(@Body() dto: PinMetadataDto) {
    const result = await this.ipfs.pinTicketMetadata({
      eventName: dto.eventName,
      tierName: dto.tierName,
      tokenId: dto.tokenId,
      description: dto.description,
      imageUri: dto.imageUri,
      externalUrl: dto.externalUrl,
      eventDate: dto.eventDate,
      venue: dto.venue,
      city: dto.city,
      ticketPrice: dto.ticketPrice,
      tierIndex: dto.tierIndex,
      maxSupply: dto.maxSupply,
      organizerAddress: dto.organizerAddress,
      contractAddress: dto.contractAddress,
    });
    return { success: true, data: result };
  }

  @Post('pin-json')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @ApiOperation({ summary: 'Pin arbitrary JSON to IPFS' })
  async pinJson(@Body() body: { json: Record<string, any>; name?: string }) {
    const result = await this.ipfs.pinJson(body.json, body.name);
    return { success: true, data: result };
  }

  @Get('status')
  @ApiOperation({ summary: 'Test IPFS (Pinata) connection' })
  async status() {
    const connected = await this.ipfs.testConnection();
    return { connected };
  }
}
