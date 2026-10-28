import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CV_UPLOAD_LIMITS } from '@ats/shared';
import { Public } from '../../common/decorators/public.decorator';
import { ClientMeta } from '../../common/decorators/client-meta.decorator';
import { CandidatesService } from './candidates.service';

@ApiTags('public/applications')
@Controller('public')
export class PublicApplicationsController {
  constructor(private readonly candidates: CandidatesService) {}

  @Public()
  @Post('campaigns/:slug/apply')
  @UseInterceptors(
    FileInterceptor('cv', {
      storage: memoryStorage(),
      limits: { fileSize: CV_UPLOAD_LIMITS.maxBytes, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'slug', example: 'tuyen-backend-engineer-nestjs' })
  @ApiBody({
    description: 'fullName, email, phone (text) + cv (PDF ≤ 5 MB)',
    schema: {
      type: 'object',
      required: ['fullName', 'email', 'phone', 'cv'],
      properties: {
        fullName: { type: 'string', example: 'Nguyễn Văn An' },
        email: { type: 'string', example: 'an.nguyen@example.com' },
        phone: { type: 'string', example: '0912345678' },
        cv: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary: 'Nộp hồ sơ — trả mã tra cứu, đẩy job phân tích AI vào queue',
  })
  apply(
    @Param('slug') slug: string,
    @Body() body: Record<string, string>,
    @UploadedFile() file: Express.Multer.File | undefined,
    @ClientMeta() meta: ClientMeta,
  ) {
    return this.candidates.apply(slug, body, file, meta);
  }

  @Public()
  @Get('track/:code')
  @ApiOperation({ summary: 'Tra cứu trạng thái hồ sơ bằng mã APP-YYYY-XXXX' })
  track(@Param('code') code: string) {
    return this.candidates.track(code);
  }
}
