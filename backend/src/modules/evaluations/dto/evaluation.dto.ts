import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class EvaluationScoreDto {
  @ApiProperty({ example: 1, description: 'ID tiêu chí thuộc rubric của vòng' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  criterionId!: number;

  @ApiProperty({ example: 8.5, description: 'Điểm chấm, 0 ≤ score ≤ maxScore của tiêu chí' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  score!: number;

  @ApiPropertyOptional({ example: 'Trả lời tốt phần transaction, còn yếu index.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class CreateEvaluationDto {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roundId!: number;

  @ApiProperty({ example: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  candidateId!: number;

  @ApiPropertyOptional({ example: 'Ứng viên nổi bật về backend.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  generalNotes?: string;

  @ApiProperty({ type: [EvaluationScoreDto], description: 'Phải phủ đủ 100% tiêu chí của vòng' })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EvaluationScoreDto)
  scores!: EvaluationScoreDto[];
}

export class UpdateEvaluationDto {
  @ApiPropertyOptional({ example: 'Cập nhật sau khi phỏng vấn vòng 2.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  generalNotes?: string;

  @ApiPropertyOptional({ type: [EvaluationScoreDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => EvaluationScoreDto)
  scores?: EvaluationScoreDto[];
}

export class AssignCandidateRoundDto {
  @ApiProperty({ example: 2, description: 'ID vòng đang IN_PROGRESS để chuyển ứng viên vào' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roundId!: number;
}
