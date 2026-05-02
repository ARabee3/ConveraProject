import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminMetricsService } from './admin-metrics.service';
import { ActivityLogService } from './activity-log.service';
import { ActivityLogScheduler } from './activity-log.scheduler';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [AdminController],
  providers: [AdminService, AdminMetricsService, ActivityLogService, ActivityLogScheduler],
  exports: [AdminService, ActivityLogService],
})
export class AdminModule {}
