import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewRequestDto {
  @ApiProperty({ description: 'Approve (true) or Reject (false)' })
  @IsBoolean()
  approved!: boolean;

  @ApiPropertyOptional({ description: 'Reason for rejection (required if rejected)' })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
