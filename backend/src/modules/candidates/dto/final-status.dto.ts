import { ApiProperty } from '@nestjs/swagger';
import { FinalStatus } from '@prisma/client';
import { IsEnum, IsIn } from 'class-validator';

export class SetFinalStatusDto {
  @ApiProperty({
    enum: [FinalStatus.PASSED, FinalStatus.REJECTED],
    example: FinalStatus.PASSED,
    description: 'Kết quả cuối của ứng viên; PENDING chỉ dùng nội bộ để sửa sai.',
  })
  @IsEnum(FinalStatus)
  @IsIn([FinalStatus.PASSED, FinalStatus.REJECTED])
  finalStatus!: 'PASSED' | 'REJECTED';
}
