import { IsOptional, IsUUID, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { EventStatus } from '@prisma/client';

export class AdminEventQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
