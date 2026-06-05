import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSupportReplyDto {
  @ApiProperty({ example: 'Thank you for reaching out. We are looking into this.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
