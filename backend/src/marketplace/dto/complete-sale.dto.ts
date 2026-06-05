import { IsString, IsOptional, IsNotEmpty, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteSaleDto {
  @ApiProperty({ description: 'Listing ID (UUID)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  listingId: string;

  @ApiProperty({ description: 'Buyer wallet address' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid Ethereum wallet address' })
  buyerWallet: string;

  @ApiProperty({ description: 'Sale transaction hash' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'Invalid transaction hash format' })
  txHash: string;

  @ApiPropertyOptional({ description: 'Platform fee in wei' })
  @IsString()
  @IsOptional()
  @Matches(/^\d+$/, { message: 'platformFeeWei must be a numeric string' })
  platformFeeWei?: string;

  @ApiPropertyOptional({ description: 'Seller proceeds in wei' })
  @IsString()
  @IsOptional()
  @Matches(/^\d+$/, { message: 'sellerProceedsWei must be a numeric string' })
  sellerProceedsWei?: string;
}
