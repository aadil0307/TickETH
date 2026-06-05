import { IsString, IsNotEmpty, IsOptional, IsObject, MaxLength, MinLength, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitRequestDto {
  @ApiProperty({ description: 'Organization name' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(200)
  orgName!: string;

  @ApiPropertyOptional({ description: 'Bio / description' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ description: 'Website URL' })
  @IsOptional()
  @IsString()
  @IsUrl({}, { message: 'Website must be a valid URL' })
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional({ description: 'Social media links', type: Object })
  @IsOptional()
  @IsObject()
  socialLinks?: Record<string, string>;
}
