import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { MailService } from './mail/mail.service';
import { NotificationService } from './notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationStatus, NotificationType } from '@prisma/client';
import * as Handlebars from 'handlebars';

@Processor('notification-delivery')
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    private readonly mailService: MailService,
    private readonly notificationService: NotificationService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(
    job: Job<{
      notificationId: string;
      to?: string;
      subject?: string;
      html?: string;
      type?: NotificationType;
      sessionId?: string;
      recipientId?: string;
    }>,
  ): Promise<void> {
    if (job.name === 'chat-digest') {
      return this.processChatDigest(
        job as Job<{ notificationId: string; sessionId: string; recipientId: string }>,
      );
    }

    const { notificationId, to, subject, html } = job.data;

    if (!to || !subject || !html) {
      this.logger.error({ message: 'Missing email fields in job', notificationId, jobId: job.id });
      await this.notificationService.updateStatus(
        notificationId,
        NotificationStatus.FAILED,
        'Missing email fields',
      );
      throw new Error('Missing email fields');
    }

    await this.notificationService.updateStatus(notificationId, NotificationStatus.SENT);

    const result = await this.mailService.sendMail(to, subject, html);
    if (result.success) {
      await this.notificationService.updateStatus(notificationId, NotificationStatus.DELIVERED);
      this.logger.log({
        message: 'Notification delivered',
        notificationId,
        jobId: job.id,
      });
      return;
    }

    const attemptsMade = job.attemptsMade + 1;
    if (attemptsMade >= 3) {
      await this.notificationService.updateStatus(
        notificationId,
        NotificationStatus.FAILED,
        result.error,
      );
      this.logger.error({
        message: 'Notification failed permanently',
        notificationId,
        error: result.error,
      });
      throw new Error(result.error ?? 'Notification delivery failed after max retries');
    } else {
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { retryCount: attemptsMade },
      });
      this.logger.warn({
        message: 'Notification delivery failed, retrying',
        notificationId,
        attempt: attemptsMade,
      });
      throw new Error(result.error);
    }
  }

  private async processChatDigest(
    job: Job<{ notificationId: string; sessionId: string; recipientId: string }>,
  ): Promise<void> {
    const { notificationId, sessionId, recipientId } = job.data;

    const prefs = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_category: {
          userId: recipientId,
          category: 'CHAT_ALERTS',
        },
      },
    });
    if (prefs && !prefs.enabled) {
      this.logger.log({
        message: 'Chat digest skipped due to preference',
        notificationId,
      });
      await this.notificationService.updateStatus(
        notificationId,
        NotificationStatus.FAILED,
        'User opted out of chat alerts',
      );
      throw new Error('User opted out of chat alerts');
    }

    const unreadMessages = await this.prisma.chatMessage.findMany({
      where: { sessionId, isRead: false },
      orderBy: { createdAt: 'asc' },
      include: { sender: { select: { email: true } } },
    });

    if (unreadMessages.length === 0) {
      this.logger.log({
        message: 'Chat digest skipped, all messages read',
        notificationId,
      });
      await this.notificationService.updateStatus(
        notificationId,
        NotificationStatus.FAILED,
        'All messages read before delivery',
      );
      throw new Error('All messages read before delivery');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: recipientId },
    });
    if (!user) {
      this.logger.error({ message: 'Recipient not found', recipientId });
      await this.notificationService.updateStatus(
        notificationId,
        NotificationStatus.FAILED,
        'Recipient not found',
      );
      throw new Error('Recipient not found');
    }

    const senderNames = Array.from(new Set(unreadMessages.map((m) => m.sender.email)));
    const sessionPreview = unreadMessages[0].content.substring(0, 100);
    const context = {
      senderName: senderNames.join(', '),
      unreadCount: unreadMessages.length,
      sessionPreview,
      conversationLink: `/chat/${sessionId}`,
      customerName: user.email,
    };

    const locale = user.preferredLocale;
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { type_locale: { type: NotificationType.CHAT_DIGEST, locale } },
    });

    let subject: string;
    let html: string;
    if (template) {
      subject = Handlebars.compile(template.subject)(context);
      html = Handlebars.compile(template.body)(context);
    } else {
      const fallbackSubject = 'New Chat Messages';
      const fallbackBody = `<p>Hi {{customerName}},</p><p>You have {{unreadCount}} unread message(s) from {{senderName}}.</p><p>Preview: {{sessionPreview}}</p>`;
      subject = Handlebars.compile(fallbackSubject)(context);
      html = Handlebars.compile(fallbackBody)(context);
    }

    await this.prisma.notification.update({
      where: { id: notificationId },
      data: { subject, status: NotificationStatus.SENT },
    });

    const result = await this.mailService.sendMail(user.email, subject, html);
    if (result.success) {
      await this.notificationService.updateStatus(notificationId, NotificationStatus.DELIVERED);
      this.logger.log({
        message: 'Chat digest delivered',
        notificationId,
        jobId: job.id,
      });
    } else {
      const attemptsMade = job.attemptsMade + 1;
      if (attemptsMade >= 3) {
        await this.notificationService.updateStatus(
          notificationId,
          NotificationStatus.FAILED,
          result.error,
        );
        this.logger.error({
          message: 'Chat digest failed permanently',
          notificationId,
          error: result.error,
        });
        throw new Error(result.error ?? 'Chat digest delivery failed after max retries');
      } else {
        await this.prisma.notification.update({
          where: { id: notificationId },
          data: { retryCount: attemptsMade },
        });
        throw new Error(result.error);
      }
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error): void {
    this.logger.error({
      message: 'Job failed after retries',
      jobId: job.id,
      error: error.message,
    });
  }
}
