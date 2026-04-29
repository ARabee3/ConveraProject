import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatProcessor } from './chat.processor';
import { ChatRateLimiterService } from './chat-rate-limiter.service';
import { ModerationService } from './moderation.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    BullModule.registerQueue({
      name: 'chat-persistence',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
      },
    }),
  ],
  providers: [ChatGateway, ChatService, ChatProcessor, ChatRateLimiterService, ModerationService],
  controllers: [ChatController],
  exports: [ChatService, ModerationService],
})
export class ChatModule {}
