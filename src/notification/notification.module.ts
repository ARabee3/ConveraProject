import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationService } from './notification.service';
import { NotificationProcessor } from './notification.processor';
import { MailModule } from './mail/mail.module';
import { NotificationPreferenceService } from './notification-preference.service';
import { BookingListener } from './listeners/booking.listener';
import { ChatListener } from './listeners/chat.listener';
import { NotificationScheduler } from './notification.scheduler';
import { NotificationPreferenceController } from './notification-preference.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notification-delivery',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
      },
    }),
    MailModule,
  ],
  controllers: [NotificationPreferenceController],
  providers: [
    NotificationService,
    NotificationProcessor,
    NotificationPreferenceService,
    BookingListener,
    ChatListener,
    NotificationScheduler,
  ],
  exports: [NotificationService, NotificationPreferenceService],
})
export class NotificationModule {}
