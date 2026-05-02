import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminActionType, Prisma } from '@prisma/client';

@Injectable()
export class ActivityLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    actorId: string,
    actionType: AdminActionType,
    targetEntityType: string,
    targetEntityId: string,
    metadata?: Record<string, unknown>,
  ) {
    return this.prisma.activityLog.create({
      data: {
        actorId,
        actionType,
        targetEntityType,
        targetEntityId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  }

  async query(filters: {
    cursor?: string;
    take?: number;
    actionType?: AdminActionType;
    startDate?: Date;
    endDate?: Date;
  }) {
    const take = filters.take ?? 20;
    const where: Prisma.ActivityLogWhereInput = {};
    if (filters.actionType) where.actionType = filters.actionType;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = filters.startDate;
      if (filters.endDate) where.createdAt.lte = filters.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where,
        take: take + 1,
        cursor: filters.cursor ? { id: filters.cursor } : undefined,
        orderBy: { createdAt: 'desc' },
        include: { actor: { select: { email: true } } },
      }),
      this.prisma.activityLog.count({ where }),
    ]);

    const hasMore = logs.length > take;
    const data = hasMore ? logs.slice(0, take) : logs;
    const nextCursor = hasMore ? data[data.length - 1].id : null;
    return { data, nextCursor, total };
  }
}
