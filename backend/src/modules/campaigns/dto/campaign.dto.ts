import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { CampaignStatus } from '@ats/shared';

export class CreateCampaignDto {
  @ApiProperty({ example: 'Tuyển Backend Engineer (NestJS)' })
  @IsString()
  @MinLength(5, { message: 'Tiêu đề tối thiểu 5 ký tự' })
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ example: 'Chiến dịch tuyển dụng cho team Platform' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiProperty({
    example: 'Cần 3 năm kinh nghiệm Node.js/NestJS, PostgreSQL, Redis, Docker...',
    description: 'Nội dung JD dùng cho AI matching — bắt buộc, tối thiểu 20 ký tự',
  })
  @IsString()
  @MinLength(20, { message: 'JD (jdText) tối thiểu 20 ký tự' })
  @MaxLength(20000)
  jdText!: string;

  @ApiProperty({ example: '2026-11-01', description: 'Định dạng YYYY-MM-DD' })
  @IsDateString({}, { message: 'startDate phải là ngày hợp lệ (YYYY-MM-DD)' })
  startDate!: string;

  @ApiProperty({ example: '2026-12-31', description: 'Định dạng YYYY-MM-DD' })
  @IsDateString({}, { message: 'endDate phải là ngày hợp lệ (YYYY-MM-DD)' })
  endDate!: string;
}

export class UpdateCampaignDto extends PartialType(CreateCampaignDto) {}

export class ListCampaignsQueryDto {
  @ApiPropertyOptional({ enum: ['DRAFT', 'OPEN', 'CLOSED'] })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @ApiPropertyOptional({ example: 'backend', description: 'Tìm theo tiêu đề' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
