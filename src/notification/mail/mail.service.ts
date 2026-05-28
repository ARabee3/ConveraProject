import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('BREVO_API_KEY') ?? '';
    if (!this.apiKey) {
      this.logger.warn('BREVO_API_KEY not set, emails will not be sent');
    } else {
      this.logger.log('Brevo API configured');
    }
  }

  async sendMail(
    to: string,
    subject: string,
    html: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const from = this.configService.get<string>('SMTP_FROM') || 'noreply@example.com';
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { email: from },
          to: [{ email: to }],
          subject,
          htmlContent: html,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Brevo API error ${String(response.status)}: ${errorBody}`);
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
