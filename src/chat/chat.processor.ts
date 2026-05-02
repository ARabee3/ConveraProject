import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface SaveMessageJob {
  messageId: string;
  sessionId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

interface MarkReadJob {
  sessionId: string;
  lastReadMessageId: string;
  readerId: string;
  senderId: string;
}

@Processor('chat-persistence')
export class ChatProcessor extends WorkerHost {
  private readonly logger = new Logger(ChatProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<SaveMessageJob | MarkReadJob>): Promise<void> {
    switch (job.name) {
      case 'save-message': {
        const data = job.data as SaveMessageJob;
        this.logger.log(
          `[chat-persistence] Processing save-message job ${String(job.id)} for message ${data.messageId}`,
        );
        try {
          await this.prisma.chatMessage.create({
            data: {
              id: data.messageId,
              sessionId: data.sessionId,
              senderId: data.senderId,
              content: data.content,
            },
          });
          this.logger.log(`[chat-persistence] Message ${data.messageId} persisted successfully`);
        } catch (error) {
          this.logger.error(
            `[chat-persistence] Failed to persist message ${data.messageId}: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
          throw error;
        }
        break;
      }
      case 'mark-read': {
        const data = job.data as MarkReadJob;
        this.logger.log(
          `[chat-persistence] Processing mark-read job ${String(job.id)} for session ${data.sessionId}`,
        );
        try {
          await this.prisma.chatMessage.updateMany({
            where: {
              sessionId: data.sessionId,
              id: { lte: data.lastReadMessageId },
              senderId: { not: data.readerId },
              isRead: false,
            },
            data: { isRead: true },
          });
          this.logger.log(
            `[chat-persistence] Marked messages as read in session ${data.sessionId}`,
          );
        } catch (error) {
          this.logger.error(
            `[chat-persistence] Failed to mark messages as read in session ${data.sessionId}: ${error instanceof Error ? error.message : String(error)}`,
            error instanceof Error ? error.stack : undefined,
          );
          throw error;
        }
        break;
      }
      default:
        this.logger.warn(`[chat-persistence] Unknown job type: ${job.name}`);
    }
  }
}
