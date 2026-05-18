import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import sgMail from '@sendgrid/mail';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter;
  private readonly sendgridApiKey: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.sendgridApiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (this.sendgridApiKey) {
      sgMail.setApiKey(this.sendgridApiKey);
      this.logger.log('SendGrid API configured');
    } else {
      this.transporter = nodemailer.createTransport({
        host: this.configService.get<string>('SMTP_HOST'),
        port: this.configService.get<number>('SMTP_PORT') || 587,
        secure: (this.configService.get<number>('SMTP_PORT') || 587) === 465,
        auth: {
          user: this.configService.get<string>('SMTP_USER'),
          pass: this.configService.get<string>('SMTP_PASS'),
        },
      });
      this.logger.log('SMTP transport configured');
    }
  }

  async sendMail(
    to: string,
    subject: string,
    html: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const from = this.configService.get<string>('SMTP_FROM') || 'noreply@example.com';
      if (this.sendgridApiKey) {
        await sgMail.send({ to, from, subject, html });
      } else {
        await this.transporter.sendMail({ from, to, subject, html });
      }
      this.logger.log({ message: 'Email sent', to, subject });
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error({ message: 'Failed to send email', to, subject, error: message });
      return { success: false, error: message };
    }
  }
}
