import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from './mail/mail.service';
import { NotificationPreferenceService } from './notification-preference.service';
import {
  NotificationType,
  NotificationStatus,
  NotificationChannel,
  NotificationCategory,
  Prisma,
} from '@prisma/client';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { sanitizeContext } from './utils/sanitize';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly preferenceService: NotificationPreferenceService,
    @InjectQueue('notification-delivery')
    private readonly deliveryQueue: Queue,
  ) {}

  async create(
    type: NotificationType,
    recipientId: string,
    relatedEntityType: string,
    relatedEntityId: string,
    templateContext: Record<string, unknown>,
  ) {
    const transactionalTypes: NotificationType[] = [
      NotificationType.BOOKING_CONFIRMATION,
      NotificationType.BOOKING_MODIFICATION,
      NotificationType.BOOKING_CANCELLATION,
      NotificationType.ACCOUNT_SUSPENSION,
      NotificationType.LISTING_REMOVED,
    ];

    if (!transactionalTypes.includes(type)) {
      const prefs = await this.preferenceService.getPreferences(recipientId);
      const category = this.typeToCategory(type);
      if (category) {
        const pref = prefs.find((p) => p.category === category);
        if (pref && !pref.enabled) {
          this.logger.log({
            message: 'Notification skipped due to preference',
            recipientId,
            type,
          });
          return null;
        }
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: recipientId },
    });
    if (!user) {
      this.logger.error({ message: 'Recipient not found', recipientId });
      return null;
    }
    if (!user.isActive && type !== NotificationType.ACCOUNT_SUSPENSION) {
      this.logger.log({
        message: 'Notification skipped for suspended user',
        recipientId,
        type,
      });
      return null;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(user.email)) {
      this.logger.error({
        message: 'User has invalid email, skipping notification',
        recipientId,
        email: user.email,
      });
      return null;
    }

    const locale = user.preferredLocale;
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { type_locale: { type, locale } },
    });

    const safeContext = sanitizeContext(templateContext);

    let subject: string;
    let html: string;

    if (template) {
      const subjectTemplate = Handlebars.compile(template.subject);
      const bodyTemplate = Handlebars.compile(template.body);
      subject = subjectTemplate(safeContext);
      html = bodyTemplate(safeContext);
    } else {
      this.logger.warn({
        message: 'DB template not found, falling back to file',
        type,
        locale,
      });
      const fallback = this.loadTemplateFromFile(type, locale);
      if (!fallback) {
        this.logger.error({ message: 'Template not found', type, locale });
        return null;
      }
      subject = Handlebars.compile(fallback.subject)(safeContext);
      html = Handlebars.compile(fallback.body)(safeContext);
    }

    const notification = await this.prisma.notification.create({
      data: {
        type,
        recipientId,
        channel: NotificationChannel.EMAIL,
        status: NotificationStatus.PENDING,
        relatedEntityType,
        relatedEntityId,
        subject,
      },
    });

    await this.deliveryQueue.add(
      'send-email',
      { notificationId: notification.id, to: user.email, subject, html },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
      },
    );

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: { status: NotificationStatus.QUEUED },
    });

    this.logger.log({
      message: 'Notification queued',
      notificationId: notification.id,
      recipientId,
      type,
    });
    return notification;
  }

  async updateStatus(id: string, status: NotificationStatus, errorMessage?: string) {
    const data: Prisma.NotificationUpdateInput = { status };
    if (status === NotificationStatus.DELIVERED) {
      data.deliveredAt = new Date();
    }
    if (errorMessage) {
      data.errorMessage = errorMessage;
    }
    return this.prisma.notification.update({ where: { id }, data });
  }

  private typeToCategory(type: NotificationType): NotificationCategory | null {
    if (type === NotificationType.EVENT_REMINDER) return NotificationCategory.REMINDERS;
    if (type === NotificationType.CHAT_DIGEST) return NotificationCategory.CHAT_ALERTS;
    return null;
  }

  private loadTemplateFromFile(
    type: NotificationType,
    locale: string,
  ): { subject: string; body: string } | null {
    const fileName = `${type.toLowerCase().replace(/_/g, '-')}.${locale}.hbs`;
    const filePath = path.join(__dirname, 'templates', fileName);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const body = fs.readFileSync(filePath, 'utf-8');
    // Derive a simple subject from type
    const subject = type.replace(/_/g, ' ');
    return { subject, body };
  }
}
