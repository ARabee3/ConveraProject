import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionStatus } from '@prisma/client';

@Injectable()
export class AdminMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics() {
    const [
      userCounts,
      totalUsers,
      totalProperties,
      activeProperties,
      totalEvents,
      activeEvents,
      bookingCounts,
      totalBookings,
      revenue,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['role'], _count: { id: true } }),
      this.prisma.user.count(),
      this.prisma.property.count(),
      this.prisma.property.count({ where: { isActive: true } }),
      this.prisma.event.count(),
      this.prisma.event.count({ where: { status: 'ACTIVE' } }),
      this.prisma.booking.groupBy({ by: ['status'], _count: { id: true } }),
      this.prisma.booking.count(),
      this.prisma.transaction.aggregate({
        _sum: { amount: true },
        where: { status: TransactionStatus.SUCCESS },
      }),
    ]);

    const byRole: Record<string, number> = {};
    userCounts.forEach((u) => {
      byRole[u.role] = u._count.id;
    });

    const byStatus: Record<string, number> = {};
    bookingCounts.forEach((b) => {
      byStatus[b.status] = b._count.id;
    });

    return {
      users: { total: totalUsers, byRole },
      properties: { total: totalProperties, active: activeProperties },
      events: { total: totalEvents, active: activeEvents },
      bookings: { total: totalBookings, byStatus },
      revenue: { total: Number(revenue._sum.amount ?? 0), currency: 'EGP' },
    };
  }
}
