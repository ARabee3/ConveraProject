import { IsEnum, IsBoolean } from 'class-validator';
import { NotificationCategory } from '@prisma/client';

export class UpdatePreferenceDto {
  @IsEnum(NotificationCategory)
  category: NotificationCategory;

  @IsBoolean()
  enabled: boolean;
}
