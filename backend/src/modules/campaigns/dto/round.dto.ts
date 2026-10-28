import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { RoundStatus } from '@ats/shared';

export class CreateRoundDto {
  @ApiProperty({ example: 'Vòng 1 — Sàng lọc CV & phỏng vấn kỹ thuật' })
  @IsString()
  @MinLength(3, { message: 'Tên vòng tối thiểu 3 ký tự' })
  @MaxLength(100)
  roundName!: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Bỏ trống để tự lấy số thứ tự tiếp theo trong campaign',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  orderIndex?: number;
}

export class UpdateRoundDto extends PartialType(CreateRoundDto) {}

export class ChangeRoundStatusDto {
  @ApiProperty({ enum: ['PENDING', 'IN_PROGRESS', 'LOCKED'], example: 'IN_PROGRESS' })
  @IsEnum(RoundStatus, { message: 'status phải là PENDING, IN_PROGRESS hoặc LOCKED' })
  status!: RoundStatus;
}
