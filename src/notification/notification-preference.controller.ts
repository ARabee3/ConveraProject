import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NotificationPreferenceService } from './notification-preference.service';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { MailService } from './mail/mail.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationPreferenceController {
  constructor(
    private readonly preferenceService: NotificationPreferenceService,
    private readonly mailService: MailService,
  ) {}

  @Get('preferences')
  async getPreferences(@Request() req: ExpressRequest & { user: { id: string } }) {
    const preferences = await this.preferenceService.getPreferences(req.user.id);
    return { preferences };
  }

  @Patch('preferences')
  async updatePreference(
    @Request() req: ExpressRequest & { user: { id: string } },
    @Body() dto: UpdatePreferenceDto,
  ) {
    const result = await this.preferenceService.updatePreference(
      req.user.id,
      dto.category,
      dto.enabled,
    );
    return { category: result.category, enabled: result.enabled, updatedAt: result.updatedAt };
  }

  @Get('test-email')
  async testEmail() {
    const result = await this.mailService.sendMail(
      'arabeea7104@gmail.com',
      'Convera Test Email',
      '<h1>Hello from Convera!</h1><p>If you see this, Brevo email delivery is working.</p>',
    );
    return result;
  }
}
