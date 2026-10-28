import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { Role, CV_UPLOAD_LIMITS } from '@ats/shared';
import { Roles } from '../../common/decorators/roles.decorator';
import { inspectCvFile } from '../../infra/storage/cv-file.validation';
import { StorageService } from '../../infra/storage/storage.service';

/**
 * Endpoint chẩn đoán storage — chỉ ADMIN.
 * Phase 2 sẽ thay bằng `POST /public/apply` (US-03) dùng cùng StorageService.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/storage-probe')
export class StorageProbeController {
  constructor(private readonly storage: StorageService) {}

  @Get('health')
  @ApiOperation({ summary: 'Kiểm tra bucket + credentials S3' })
  async health(): Promise<{ ok: true; bucket: string; endpoint: string }> {
    await this.storage.ping();
    return { ok: true, bucket: this.storage.getBucket(), endpoint: 'ok' };
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: CV_UPLOAD_LIMITS.maxBytes, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'File PDF (tối đa 5 MB)',
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOperation({ summary: 'Upload thử CV: kiểm magic-byte → lưu RustFS → trả signed URL' })
  async upload(@UploadedFile() file: Express.Multer.File | undefined): Promise<{
    bucket: string;
    key: string;
    size: number;
    sha256: string;
    expiresInSeconds: number;
    signedUrl: string;
  }> {
    if (!file) {
      throw new BadRequestException('Thiếu file — gửi multipart với field tên "file"');
    }

    // Không tin Content-Type: đọc 4 byte đầu của nội dung
    const inspected = inspectCvFile(file.buffer);
    const key = this.storage.buildCvKey();

    await this.storage.putObject(key, file.buffer);
    const signedUrl = await this.storage.getSignedDownloadUrl(key);

    return {
      bucket: this.storage.getBucket(),
      key,
      size: inspected.size,
      sha256: inspected.sha256,
      expiresInSeconds: this.storage.getDefaultTtl(),
      signedUrl,
    };
  }

  @Get('download')
  @ApiOperation({ summary: 'Cấp signed URL mới cho một object đã upload' })
  async download(
    @Query('key') key: string | undefined,
  ): Promise<{ key: string; expiresInSeconds: number; signedUrl: string }> {
    if (!key) throw new BadRequestException('Thiếu query param "key"');

    // Chặn đọc object ngoài prefix cv/ (dò key của bucket khác)
    if (!this.storage.isManagedKey(key)) {
      throw new BadRequestException('Key không hợp lệ');
    }

    return {
      key,
      expiresInSeconds: this.storage.getDefaultTtl(),
      signedUrl: await this.storage.getSignedDownloadUrl(key),
    };
  }
}
