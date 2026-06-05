import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyDto {
  @ApiProperty({ description: 'SIWE message string' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message!: string;

  @ApiProperty({ description: 'Wallet signature of the SIWE message' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  signature!: string;
}
