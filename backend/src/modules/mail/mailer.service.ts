import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Gửi email qua SMTP (Mailpit ở dev, SMTP thật ở production). */
@Injectable()
export class MailerService implements OnModuleDestroy {
  private readonly logger = new Logger(MailerService.name);
  private readonly transport: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    const user = config.get<string>('SMTP_USER', '');
    const pass = config.get<string>('SMTP_PASS', '');

    this.from = config.get<string>('MAIL_FROM', 'AI-Powered ATS <no-reply@ats.local>');
    this.transport = createTransport({
      host: config.get<string>('SMTP_HOST', 'localhost'),
      port: config.get<number>('SMTP_PORT', 1025),
      secure: config.get<boolean>('SMTP_SECURE', false),
      ...(user ? { auth: { user, pass } } : {}),
    });
  }

  async send(email: OutgoingEmail): Promise<void> {
    const info = await this.transport.sendMail({
      from: this.from,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });

    this.logger.log(`Đã gửi email tới ${email.to} (messageId=${info.messageId})`);
  }

  async onModuleDestroy(): Promise<void> {
    this.transport.close();
  }
}
