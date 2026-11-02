import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@ats/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { CopilotRequestDto } from './dto/copilot.dto';
import { CopilotService } from './copilot.service';

@ApiTags('ai/copilot')
@ApiBearerAuth()
@Roles(Role.INTERVIEWER, Role.ADMIN)
@Controller('ai/copilot')
export class CopilotController {
  constructor(private readonly copilot: CopilotService) {}

  @Post('questions')
  @ApiOperation({ summary: 'Sinh câu hỏi phỏng vấn từ skill gap giữa CV và JD (US-08)' })
  questions(@Body() dto: CopilotRequestDto) {
    return this.copilot.generate(dto);
  }
}
