import { Injectable } from '@nestjs/common';

export interface ModerationResult {
  violation: boolean;
  violationType?: string;
  redacted: string;
}

@Injectable()
export class ModerationService {
  private readonly emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  private readonly phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
  private readonly urlRegex = /(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/g;

  scan(content: string): ModerationResult {
    let redacted = content;
    let violation = false;
    let violationType: string | undefined;

    if (this.emailRegex.test(content)) {
      violation = true;
      violationType = 'EMAIL';
      redacted = redacted.replace(this.emailRegex, '[REDACTED-EMAIL]');
    }

    if (this.phoneRegex.test(content)) {
      violation = true;
      violationType = violationType ? `${violationType},PHONE` : 'PHONE';
      redacted = redacted.replace(this.phoneRegex, '[REDACTED-PHONE]');
    }

    if (this.urlRegex.test(content)) {
      violation = true;
      violationType = violationType ? `${violationType},URL` : 'URL';
      redacted = redacted.replace(this.urlRegex, '[REDACTED-URL]');
    }

    return { violation, violationType, redacted };
  }
}
