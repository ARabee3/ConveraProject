import { IsOptional, IsUUID, IsInt, Min, Max, IsEnum, IsDateString } from 'class-validator';
import { AdminActionType } from '@prisma/client';

export class ActivityLogQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  @IsOptional()
  @IsEnum(AdminActionType)
  actionType?: AdminActionType;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
