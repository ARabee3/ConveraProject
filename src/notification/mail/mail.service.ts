import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT') || 587,
      secure: (this.configService.get<number>('SMTP_PORT') || 587) === 465,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendMail(
    to: string,
    subject: string,
    html: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const from = this.configService.get<string>('SMTP_FROM');
      await this.transporter.sendMail({ from, to, subject, html });
      this.logger.log({ message: 'Email sent', to, subject });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({ message: 'Failed to send email', to, subject, error: message });
      return { success: false, error: message };
    }
  }
}
