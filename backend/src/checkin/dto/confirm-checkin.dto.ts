import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ConfirmCheckinDto {
  @ApiProperty({ description: 'Check-in log ID from scan step' })
  @IsString()
  @IsNotEmpty()
  checkinLogId!: string;

  @ApiPropertyOptional({ description: 'Attendee wallet address' })
  @IsOptional()
  @IsString()
  attendeeWallet?: string;
}
