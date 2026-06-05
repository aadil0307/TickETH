import { IsString, IsNotEmpty, IsInt, IsOptional, Min, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordMintDto {
  @ApiPropertyOptional({ description: 'On-chain token ID (resolved from chain if not provided)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  tokenId?: number;

  @ApiProperty({ description: 'Event contract address' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid contract address format' })
  contractAddress!: string;

  @ApiProperty({ description: 'Event UUID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  eventId!: string;

  @ApiProperty({ description: 'Tier UUID' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  tierId!: string;

  @ApiProperty({ description: 'Wallet that minted' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^0x[a-fA-F0-9]{40}$/, { message: 'Invalid wallet address format' })
  ownerWallet!: string;

  @ApiPropertyOptional({ description: 'Mint transaction hash' })
  @IsOptional()
  @IsString()
  @Matches(/^0x[a-fA-F0-9]{64}$/, { message: 'Invalid transaction hash format' })
  txHash?: string;

  @ApiPropertyOptional({ description: 'IPFS metadata URI' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  metadataUri?: string;
}
