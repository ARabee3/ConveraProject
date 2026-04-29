import { ModerationService } from './moderation.service';

describe('ModerationService', () => {
  let service: ModerationService;

  beforeEach(() => {
    service = new ModerationService();
  });

  it('should pass clean content without violation', () => {
    const result = service.scan('This is a clean message');
    expect(result.violation).toBe(false);
    expect(result.redacted).toBe('This is a clean message');
  });

  it('should detect and redact email addresses', () => {
    const result = service.scan('Contact me at test@example.com');
    expect(result.violation).toBe(true);
    expect(result.violationType).toContain('EMAIL');
    expect(result.redacted).toBe('Contact me at [REDACTED-EMAIL]');
  });

  it('should detect and redact phone numbers', () => {
    const result = service.scan('Call me at +1-555-123-4567');
    expect(result.violation).toBe(true);
    expect(result.violationType).toContain('PHONE');
    expect(result.redacted).toBe('Call me at [REDACTED-PHONE]');
  });

  it('should detect and redact URLs', () => {
    const result = service.scan('Visit https://example.com for more info');
    expect(result.violation).toBe(true);
    expect(result.violationType).toContain('URL');
    expect(result.redacted).toBe('Visit [REDACTED-URL] for more info');
  });

  it('should detect multiple violations in one message', () => {
    const result = service.scan('Email me at foo@bar.com or visit https://test.com');
    expect(result.violation).toBe(true);
    expect(result.redacted).toBe('Email me at [REDACTED-EMAIL] or visit [REDACTED-URL]');
  });
});
