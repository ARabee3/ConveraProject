import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsNumber,
  IsUUID,
  IsInt,
  Min,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class EventEligibilityDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  minAge?: number;

  @IsArray()
  @IsString({ each: true })
  ticketTypes: string[];

  @IsOptional()
  @IsString()
  specialRequirements?: string;
}

class EventGalleryImageDto {
  @IsString()
  @IsNotEmpty()
  imageUrl: string;

  @IsInt()
  @Min(0)
  displayOrder: number;
}

export class CreateEventDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsDateString()
  date: string;

  @IsNumber()
  locationLat: number;

  @IsNumber()
  locationLng: number;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsUUID()
  categoryId: string;

  @IsInt()
  @Min(1)
  maxCapacity: number;

  @IsString()
  @IsNotEmpty()
  coverImage: string;

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
