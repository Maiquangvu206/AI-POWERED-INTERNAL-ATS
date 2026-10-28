import { Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@ats/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { CandidatesService } from './candidates.service';

@ApiTags('admin/candidates')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/candidates')
export class AdminCandidatesController {
  constructor(private readonly candidates: CandidatesService) {}

  @Post(':id/reprocess')
  @ApiOperation({ summary: 'Đẩy lại job phân tích AI cho hồ sơ (retry thủ công)' })
  reprocess(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') actorId: number,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.candidates.reprocess(id, actorId, meta);
  }
}
