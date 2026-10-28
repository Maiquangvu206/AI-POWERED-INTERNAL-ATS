import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { CampaignStatus } from '@ats/shared';

export class ChangeCampaignStatusDto {
  @ApiProperty({ enum: ['DRAFT', 'OPEN', 'CLOSED'], example: 'OPEN' })
  @IsEnum(CampaignStatus, { message: 'status phải là DRAFT, OPEN hoặc CLOSED' })
  status!: CampaignStatus;
}
