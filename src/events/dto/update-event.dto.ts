import {
  IsString,
  IsDateString,
  IsNumber,
  IsUUID,
  IsInt,
  Min,
  IsOptional,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EventStatus } from '@prisma/client';

class EventEligibilityDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  minAge?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ticketTypes?: string[];

  @IsOptional()
  @IsString()
  specialRequirements?: string;
}

class EventGalleryImageDto {
  @IsString()
  imageUrl: string;

  @IsInt()
  @Min(0)
  displayOrder: number;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsNumber()
  locationLat?: number;

  @IsOptional()
  @IsNumber()
  locationLng?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxCapacity?: number;

  @IsOptional()
  @IsString()
  coverImage?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => EventEligibilityDto)
  eligibility?: EventEligibilityDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EventGalleryImageDto)
  galleryImages?: EventGalleryImageDto[];
}
