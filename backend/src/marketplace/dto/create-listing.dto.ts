import { IsString, IsNumber, IsOptional, IsNotEmpty, Min, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateListingDto {
  @ApiProperty({ description: 'Ticket ID (UUID from DB)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  ticketId: string;

  @ApiProperty({ description: 'Asking price in wei (exact string)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+$/, { message: 'askingPriceWei must be a numeric string' })
  @MaxLength(78) // Max uint256 has 78 digits
  askingPriceWei: string;

  @ApiPropertyOptional({ description: 'Asking price in MATIC (human readable)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  askingPrice?: number;

  @ApiPropertyOptional({ description: 'Listing transaction hash (escrow transfer)' })
  @IsString()
  @IsOptional()
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'Invalid transaction hash format' })
  listingTxHash?: string;
}
