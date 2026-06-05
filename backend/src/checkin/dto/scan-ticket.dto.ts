import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ScanTicketDto {
  @ApiProperty({ description: 'Ticket UUID' })
  @IsString()
  @IsNotEmpty()
  ticketId!: string;

  @ApiProperty({ description: 'Event UUID' })
  @IsString()
  @IsNotEmpty()
  eventId!: string;

  @ApiProperty({ description: 'QR nonce' })
  @IsString()
  @IsNotEmpty()
  nonce!: string;

  @ApiPropertyOptional({ description: 'QR expiry timestamp (ms)' })
  @IsOptional()
  @IsNumber()
  expiresAt?: number;

  @ApiPropertyOptional({ description: 'HMAC-SHA256 signature of the QR payload' })
  @IsOptional()
  @IsString()
  hmac?: string;

  @ApiPropertyOptional({ description: 'Scanned while offline' })
  @IsOptional()
  @IsBoolean()
  offlineSync?: boolean;
}
