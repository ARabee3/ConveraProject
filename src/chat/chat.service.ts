import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationService } from './moderation.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ChatMessageSentEvent } from './events/chat-message-sent.event';
import { randomUUID } from 'crypto';

export interface ChatMessagePayload {
  id: string;
  sessionId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('chat-persistence') private readonly chatQueue: Queue,
    private readonly moderationService: ModerationService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async sendMessage(
    sessionId: string,
    senderId: string,
    content: string,
  ): Promise<ChatMessagePayload | null> {
    const moderationResult = this.moderationService.scan(content);

    // If violation is severe enough or if we want to reject entirely:
    // For this implementation, we allow redacted content but log the violation.
    // If we wanted strict rejection, we'd return null here.
    const finalContent = moderationResult.redacted;

    // In our spec, we said "reject or redact". Let's choose to reject for US4 acceptance.
    if (moderationResult.violation) {
      this.logger.warn(`Policy violation detected for user ${senderId}. Message rejected.`);
      return null;
    }

    const messageId = randomUUID();
    const createdAt = new Date().toISOString();

    // Broadcast immediately for real-time delivery
    const payload: ChatMessagePayload = {
      id: messageId,
      sessionId,
      senderId,
      content: finalContent,
      createdAt,
    };

    // Queue for asynchronous persistence
    await this.chatQueue.add('save-message', {
      messageId,
      sessionId,
      senderId,
      content: finalContent,
      createdAt,
    });

    // Determine recipient and emit event
    const session = await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: { property: true },
    });
    const recipientId =
      session && session.property.hostId === senderId
        ? session.customerId
        : session?.property.hostId;

    if (recipientId) {
      this.eventEmitter.emit(
        'chat.message.sent',
        new ChatMessageSentEvent(sessionId, messageId, senderId, recipientId, finalContent),
      );
    }

    return payload;
  }

  async validateSessionMembership(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.prisma.chatSession.findFirst({
      where: {
        id: sessionId,
        OR: [{ customerId: userId }, { property: { hostId: userId } }],
      },
    });
    return !!session;
  }

  async getHistory(
    sessionId: string,
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<ChatMessagePayload[]> {
    const isMember = await this.validateSessionMembership(sessionId, userId);
    if (!isMember) {
      throw new ForbiddenException('Unauthorized: You are not a member of this chat session');
    }

    const messages = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return messages.reverse().map((msg) => ({
      id: msg.id,
      sessionId: msg.sessionId,
      senderId: msg.senderId,
      content: msg.content,
      createdAt: msg.createdAt.toISOString(),
    }));
  }

  async markAsRead(sessionId: string, lastMessageId: string, readerId: string): Promise<void> {
    // Check membership before queueing
    const isMember = await this.validateSessionMembership(sessionId, readerId);
    if (!isMember) return;

    const lastReadMessage = await this.prisma.chatMessage.findUnique({
      where: { id: lastMessageId },
    });

    if (lastReadMessage) {
      await this.chatQueue.add('mark-read', {
        sessionId,
        lastReadMessageId: lastMessageId,
        readerId,
        senderId: lastReadMessage.senderId,
      });
    }
  }
}
