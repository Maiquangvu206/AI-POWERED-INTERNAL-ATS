import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateCriteriaDto {
  @ApiProperty({ example: 'Kinh nghiệm backend (NestJS/Node.js)' })
  @IsString()
  @MinLength(2, { message: 'Tên tiêu chí tối thiểu 2 ký tự' })
  @MaxLength(200)
  title!: string;

  @ApiProperty({ example: 10, description: 'Điểm tối đa của tiêu chí (> 0)' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'maxScore tối đa 2 chữ số thập phân' })
  @Min(0.01)
  @Max(100)
  maxScore!: number;

  @ApiProperty({
    example: 0.4,
    description: 'Trọng số 0 < weight ≤ 1; tổng weight mỗi vòng phải = 1.000 (±0.001)',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 }, { message: 'weight tối đa 3 chữ số thập phân' })
  @Min(0.001)
  @Max(1)
  weight!: number;
}

export class UpdateCriteriaDto extends PartialType(CreateCriteriaDto) {}
