import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationCategory } from '@prisma/client';

@Injectable()
export class NotificationPreferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async getPreferences(userId: string) {
    const categories = Object.values(NotificationCategory);
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    return categories.map((category) => {
      const pref = preferences.find(
        (p: { category: NotificationCategory; enabled: boolean }) => p.category === category,
      );
      return { category, enabled: pref ? pref.enabled : true };
    });
  }

  async updatePreference(userId: string, category: NotificationCategory, enabled: boolean) {
    if (!Object.values(NotificationCategory).includes(category)) {
      throw new Error('Invalid notification category');
    }
    return this.prisma.notificationPreference.upsert({
      where: { userId_category: { userId, category } },
      create: { userId, category, enabled },
      update: { enabled },
    });
  }
}
