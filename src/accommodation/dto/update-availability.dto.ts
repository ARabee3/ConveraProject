import { IsDateString, IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { AvailabilityStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdateAvailabilityDto {
  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsEnum(AvailabilityStatus)
  status: AvailabilityStatus;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  overridePrice?: number;
}
