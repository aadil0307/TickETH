import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { SupportTicketStatus } from '../../common/enums';

export class UpdateTicketStatusDto {
  @ApiProperty({ enum: SupportTicketStatus })
  @IsEnum(SupportTicketStatus)
  status: SupportTicketStatus;
}
