import { Controller, Get, Patch, Param, Query, UseGuards, Request, Body } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { AdminMetricsService } from './admin-metrics.service';
import { ActivityLogService } from './activity-log.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { ChangeUserStatusDto } from './dto/change-status.dto';
import { AdminEventQueryDto } from './dto/admin-event-query.dto';
import { AdminPropertyQueryDto } from './dto/admin-property-query.dto';
import { ChangePropertyStatusDto } from './dto/change-property-status.dto';
import { ActivityLogQueryDto } from './dto/activity-log-query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SYSTEM_ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminMetricsService: AdminMetricsService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  @Get('users')
  async listUsers(@Query() query: AdminUserQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get('users/:id')
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id/status')
  async changeUserStatus(
    @Param('id') id: string,
    @Body() dto: ChangeUserStatusDto,
    @Request() req: ExpressRequest & { user: { id: string } },
  ) {
    return this.adminService.changeUserStatus(id, dto, req.user.id);
  }

  @Get('events')
  async listEvents(@Query() query: AdminEventQueryDto) {
    return this.adminService.listEvents(query);
  }

  @Get('properties')
  async listProperties(@Query() query: AdminPropertyQueryDto) {
    return this.adminService.listProperties(query);
  }

  @Patch('properties/:id/status')
  async changePropertyStatus(
    @Param('id') id: string,
    @Body() dto: ChangePropertyStatusDto,
    @Request() req: ExpressRequest & { user: { id: string } },
  ) {
    return this.adminService.changePropertyStatus(id, dto, req.user.id);
  }

  @Get('metrics')
  async getDashboardMetrics() {
    return this.adminMetricsService.getDashboardMetrics();
  }

  @Get('activity-logs')
  async getActivityLogs(@Query() query: ActivityLogQueryDto) {
    return this.activityLogService.query({
      cursor: query.cursor,
      take: query.take,
      actionType: query.actionType,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
  }
}
