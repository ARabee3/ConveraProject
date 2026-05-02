import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';
import { NotificationPreferenceService } from './notification-preference.service';
import { NotificationType, EventStatus } from '@prisma/client';

@Injectable()
export class NotificationScheduler {
  private readonly logger = new Logger(NotificationScheduler.name);
  private readonly BATCH_SIZE = 500;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly preferenceService: NotificationPreferenceService,
  ) {}

  @Cron('0 */15 * * * *')
  async sendEventReminders() {
    this.logger.log('Scanning for event reminders');
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    let processed = 0;
    let lastId: string | undefined;

    while (true) {
      const registrations = await this.prisma.eventRegistration.findMany({
        where: {
          status: 'CONFIRMED',
          event: {
            status: EventStatus.ACTIVE,
            date: { gte: now, lte: in24Hours },
          },
        },
        take: this.BATCH_SIZE,

        ...(lastId ? { skip: 1, cursor: { id: lastId } } : {}),
        orderBy: { id: 'asc' },
        include: { event: true, user: true },
      });

      if (registrations.length === 0) {
        break;
      }

      for (const reg of registrations) {
        // Check for duplicate reminder
        const existing = await this.prisma.notification.findFirst({
          where: {
            type: NotificationType.EVENT_REMINDER,
            relatedEntityType: 'event_registration',
            relatedEntityId: reg.id,
          },
        });
        if (existing) {
          continue;
        }

        // Check user preference
        const prefs = await this.preferenceService.getPreferences(reg.userId);
        const reminderPref = prefs.find((p) => p.category === 'REMINDERS');
        if (reminderPref && !reminderPref.enabled) {
          this.logger.log({
            message: 'Reminder skipped due to preference',
            userId: reg.userId,
            eventId: reg.eventId,
          });
          continue;
        }

        const context = {
          eventName: reg.event.title,
          eventDate: reg.event.date.toISOString(),
          eventTime: reg.event.date.toISOString(),
          eventLocation: reg.event.address,
          bookingReference: reg.id,
        };

        await this.notificationService.create(
          NotificationType.EVENT_REMINDER,
          reg.userId,
          'event_registration',
          reg.id,
          context,
        );
        processed++;
      }

      if (registrations.length < this.BATCH_SIZE) {
        break;
      }
      lastId = registrations[registrations.length - 1].id;
    }

    this.logger.log(`Processed ${String(processed)} event reminder candidates`);
  }
}
