import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CopilotRequestDto {
  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  candidateId!: number;

  @ApiPropertyOptional({ example: 3, description: 'Vòng phỏng vấn — dùng để lấy ngữ cảnh rubric' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  roundId?: number;

  @ApiPropertyOptional({ example: 5, description: 'Số câu hỏi cần sinh (1–10)' })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  count?: number;
}
