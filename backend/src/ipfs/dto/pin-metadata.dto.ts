import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PinMetadataDto {
  @ApiProperty({ description: 'Event name' })
  @IsString()
  eventName!: string;

  @ApiProperty({ description: 'Tier name' })
  @IsString()
  tierName!: string;

  @ApiProperty({ description: 'Token ID' })
  @IsNumber()
  @Min(1)
  tokenId!: number;

  @ApiPropertyOptional({ description: 'Ticket description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Image IPFS URI or HTTP URL' })
  @IsOptional()
  @IsString()
  imageUri?: string;

  @ApiPropertyOptional({ description: 'External URL for the ticket' })
  @IsOptional()
  @IsString()
  externalUrl?: string;

  @ApiPropertyOptional({ description: 'Event date (ISO 8601)' })
  @IsOptional()
  @IsString()
  eventDate?: string;

  @ApiPropertyOptional({ description: 'Event venue' })
  @IsOptional()
  @IsString()
  venue?: string;

  @ApiPropertyOptional({ description: 'Event city' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ description: 'Human-readable ticket price' })
  @IsOptional()
  @IsString()
  ticketPrice?: string;

  @ApiPropertyOptional({ description: 'Tier index (0-based)' })
  @IsOptional()
  @IsNumber()
  tierIndex?: number;

  @ApiPropertyOptional({ description: 'Max supply for this tier' })
  @IsOptional()
  @IsNumber()
  maxSupply?: number;

  @ApiPropertyOptional({ description: 'Organizer wallet address' })
  @IsOptional()
  @IsString()
  organizerAddress?: string;

  @ApiPropertyOptional({ description: 'Contract address on-chain' })
  @IsOptional()
  @IsString()
  contractAddress?: string;
}
