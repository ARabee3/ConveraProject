import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NotificationType, NotificationChannel, NotificationStatus } from '@prisma/client';
import { ChatMessageSentEvent } from '../../chat/events/chat-message-sent.event';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ChatListener {
  private readonly logger = new Logger(ChatListener.name);

  constructor(
    @InjectQueue('notification-delivery') private readonly deliveryQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('chat.message.sent')
  async handleChatMessageSent(event: ChatMessageSentEvent) {
    this.logger.log({
      message: 'Chat message sent event received',
      sessionId: event.sessionId,
      recipientId: event.recipientId,
    });

    // Debounce: check if a pending or queued chat digest already exists for this session/recipient
    const existing = await this.prisma.notification.findFirst({
      where: {
        type: NotificationType.CHAT_DIGEST,
        recipientId: event.recipientId,
        relatedEntityType: 'chat_session',
        relatedEntityId: event.sessionId,
        status: { in: [NotificationStatus.PENDING, NotificationStatus.QUEUED] },
      },
    });

    if (existing) {
      this.logger.log({
        message: 'Chat digest already pending/queued for session, skipping duplicate',
        sessionId: event.sessionId,
        recipientId: event.recipientId,
      });
      return;
    }

    const notification = await this.prisma.notification.create({
      data: {
        type: NotificationType.CHAT_DIGEST,
        recipientId: event.recipientId,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.PENDING,
        relatedEntityType: 'chat_session',
        relatedEntityId: event.sessionId,
      },
    });

    await this.deliveryQueue.add(
      'chat-digest',
      {
        notificationId: notification.id,
        sessionId: event.sessionId,
        recipientId: event.recipientId,
      },
      {
        delay: 5 * 60 * 1000, // 5 minutes
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
      },
    );
  }
}
