import { Global, Module } from '@nestjs/common';
import { EmailProcessor } from './email.processor';
import { MailService } from './mail.service';
import { MailerService } from './mailer.service';

/**
 * Global để module Candidates/Evaluations dùng MailService mà không phải
 * import lặp lại. Queue `email` được đăng ký ở QueueModule (global).
 */
@Global()
@Module({
  providers: [MailerService, MailService, EmailProcessor],
  exports: [MailService],
})
export class MailModule {}
