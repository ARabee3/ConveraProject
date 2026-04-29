import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

@Injectable()
export class ChatRateLimiterService {
  private readonly logger = new Logger(ChatRateLimiterService.name);
  private readonly maxRequests = 30;
  private readonly windowSeconds = 60;

  constructor(private readonly redisService: RedisService) {}

  async checkLimit(userId: string): Promise<RateLimitResult> {
    const key = `chat:rate_limit:${userId}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - this.windowSeconds;

    try {
      const count = await this.redisService.incrementWithTtl(key, this.windowSeconds);

      if (count > this.maxRequests) {
        return { allowed: false, remaining: 0, resetTime: now + this.windowSeconds };
      }

      return { allowed: true, remaining: this.maxRequests - count, resetTime: now + this.windowSeconds };
    } catch (error) {
      this.logger.error(`Rate limiter error for user ${userId}: ${error instanceof Error ? error.message : String(error)}`);
      // Fail open if Redis is unavailable
      return { allowed: true, remaining: this.maxRequests, resetTime: now + this.windowSeconds };
    }
  }
}
