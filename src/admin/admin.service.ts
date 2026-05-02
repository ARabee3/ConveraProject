import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { ChangeUserStatusDto } from './dto/change-status.dto';
import { AdminEventQueryDto } from './dto/admin-event-query.dto';
import { AdminPropertyQueryDto } from './dto/admin-property-query.dto';
import { ChangePropertyStatusDto } from './dto/change-property-status.dto';
import { ListingStatus } from '@prisma/client';
import { ActivityLogService } from './activity-log.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType, AdminActionType } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activityLogService: ActivityLogService,
    private readonly notificationService: NotificationService,
  ) {}

  async listUsers(query: AdminUserQueryDto) {
    const take = query.take ?? 20;
    const where: Record<string, unknown> = {};
    if (query.role) where.role = query.role;
    if (query.status !== undefined) where.isActive = query.status === 'active';
    if (query.search) where.email = { contains: query.search, mode: 'insensitive' };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        take: take + 1,
        cursor: query.cursor ? { id: query.cursor } : undefined,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          role: true,
          isVerified: true,
          isActive: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    const hasMore = users.length > take;
    const data = hasMore ? users.slice(0, take) : users;
    const nextCursor = hasMore ? data[data.length - 1].id : null;
    return { data, nextCursor, total };
  }

  async getUserDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        isVerified: true,
        isActive: true,
        createdAt: true,
        _count: { select: { bookings: true, properties: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      ...user,
      bookingCount: user._count.bookings,
      propertyCount: user._count.properties,
      lastLoginAt: null,
    };
  }

  async changeUserStatus(userId: string, dto: ChangeUserStatusDto, actorId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: dto.status === 'active' },
      select: {
        id: true,
        email: true,
        isActive: true,
        updatedAt: true,
      },
    });

    const actionType =
      dto.status === 'suspended' ? AdminActionType.USER_SUSPENDED : AdminActionType.USER_ACTIVATED;
    await this.activityLogService.log(actorId, actionType, 'user', userId, { reason: dto.reason });

    if (dto.status === 'suspended') {
      await this.notificationService.create(
        NotificationType.ACCOUNT_SUSPENSION,
        userId,
        'user',
        userId,
        { customerName: user.email },
      );
    }

    return updated;
  }

  async listEvents(query: AdminEventQueryDto) {
    const take = query.take ?? 20;
    const where: Record<string, unknown> = {};
    if (query.status) where.status = query.status;
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        take: take + 1,
        cursor: query.cursor ? { id: query.cursor } : undefined,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.event.count({ where }),
    ]);

    const hasMore = events.length > take;
    const data = hasMore ? events.slice(0, take) : events;
    const nextCursor = hasMore ? data[data.length - 1].id : null;
    return { data, nextCursor, total };
  }

  async listProperties(query: AdminPropertyQueryDto) {
    const take = query.take ?? 20;
    const where: Record<string, unknown> = {};
    if (query.status) where.listingStatus = query.status.toUpperCase() as ListingStatus;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { address: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        take: take + 1,
        cursor: query.cursor ? { id: query.cursor } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
          host: { select: { email: true } },
          _count: { select: { bookings: true } },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    const hasMore = properties.length > take;
    const data = hasMore ? properties.slice(0, take) : properties;
    const nextCursor = hasMore ? data[data.length - 1].id : null;
    return {
      data: data.map((p) => ({
        id: p.id,
        title: p.title,
        hostId: p.hostId,
        hostEmail: p.host.email,
        address: p.address,
        type: p.type,
        isActive: p.isActive,
        listingStatus: p.listingStatus,
        bookingCount: p._count.bookings,
        createdAt: p.createdAt,
      })),
      nextCursor,
      total,
    };
  }

  async changePropertyStatus(propertyId: string, dto: ChangePropertyStatusDto, actorId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: { host: true },
    });
    if (!property) throw new NotFoundException('Property not found');

    const updated = await this.prisma.property.update({
      where: { id: propertyId },
      data: { listingStatus: dto.status.toUpperCase() as ListingStatus },
      select: {
        id: true,
        title: true,
        listingStatus: true,
        updatedAt: true,
      },
    });

    const actionMap: Record<string, AdminActionType> = {
      active: AdminActionType.PROPERTY_ACTIVATED,
      hidden: AdminActionType.PROPERTY_HIDDEN,
      removed: AdminActionType.PROPERTY_REMOVED,
    };
    await this.activityLogService.log(actorId, actionMap[dto.status], 'property', propertyId, {
      reason: dto.reason,
    });

    if (dto.status === 'removed') {
      await this.notificationService.create(
        NotificationType.LISTING_REMOVED,
        property.hostId,
        'property',
        propertyId,
        { hostName: property.host.email, propertyName: property.title },
      );
    }

    return updated;
  }
}
