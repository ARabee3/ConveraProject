import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityLogScheduler {
  private readonly logger = new Logger(ActivityLogScheduler.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 0 3 * * *')
  async cleanupOldLogs() {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const result = await this.prisma.activityLog.deleteMany({
      where: { createdAt: { lt: sixMonthsAgo } },
    });

    this.logger.log(`Deleted ${String(result.count)} activity logs older than 6 months`);
  }
}
