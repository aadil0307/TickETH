import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  IsBoolean,
  IsDateString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTierDto {
  @ApiProperty({ description: 'On-chain tier index' })
  @IsInt()
  @Min(0)
  tierIndex!: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Price in MATIC' })
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiProperty({ description: 'Exact price in wei (string)' })
  @IsString()
  @IsNotEmpty()
  priceWei!: string;

  @ApiPropertyOptional({ default: 'MATIC' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  maxSupply!: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  resaleAllowed?: boolean;

  @ApiPropertyOptional({ description: 'Sale start time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Sale end time (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({ description: '0 = unlimited', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxPerWallet?: number;

  @ApiPropertyOptional({ description: 'Merkle root for whitelist (null = public)' })
  @IsOptional()
  @IsString()
  merkleRoot?: string;

  @ApiPropertyOptional({ description: 'Max resales per ticket (0 = unlimited)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxResales?: number;

  @ApiPropertyOptional({ description: 'Max price deviation in bps (1000 = ±10%, 0 = no cap)', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  maxPriceDeviationBps?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
