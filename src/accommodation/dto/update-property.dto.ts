import { IsString, IsEnum, IsNumber, IsArray, IsOptional, MinLength } from 'class-validator';
import { PropertyType } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdatePropertyDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(PropertyType)
  type?: PropertyType;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsArray()
  amenities?: string[];

  @IsOptional()
  @IsArray()
  imageUrls?: string[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  basePrice?: number;
}
