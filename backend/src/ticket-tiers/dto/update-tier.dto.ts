import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTierDto } from './create-tier.dto';

export class UpdateTierDto extends PartialType(
  OmitType(CreateTierDto, ['tierIndex'] as const),
) {}
