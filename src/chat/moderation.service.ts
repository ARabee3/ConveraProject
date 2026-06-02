import { Injectable } from '@nestjs/common';

export interface ModerationResult {
  violation: boolean;
  violationType?: string;
  redacted: string;
}

@Injectable()
export class ModerationService {
  // Create fresh regex instances per scan to avoid /g flag state mutation issues
  private emailRegex() { return /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/; }
  private phoneRegex() { return /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,}\)?[-.\s]?\d{3,}[-.\s]?\d{4,}/; }
  private urlRegex() { return /https?:\/\/[^\s]+/; }

  scan(content: string): ModerationResult {
    let redacted = content;
    let violation = false;
    let violationType: string | undefined;

    // Only detect explicit full emails: user@domain.tld
    if (this.emailRegex().test(content)) {
      violation = true;
      violationType = 'EMAIL';
      redacted = redacted.replace(this.emailRegex(), '[REDACTED-EMAIL]');
    }

    // Only detect explicit phone patterns with 10+ digits
    if (this.phoneRegex().test(content)) {
      violation = true;
      violationType = violationType ? `${violationType},PHONE` : 'PHONE';
      redacted = redacted.replace(this.phoneRegex(), '[REDACTED-PHONE]');
    }

    // Only detect explicit http/https URLs
    if (this.urlRegex().test(content)) {
      violation = true;
      violationType = violationType ? `${violationType},URL` : 'URL';
      redacted = redacted.replace(this.urlRegex(), '[REDACTED-URL]');
    }

    return { violation, violationType, redacted };
  }
}
