import { IsString, IsEnum, IsNumber, IsArray, IsNotEmpty, MinLength } from 'class-validator';
import { PropertyType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreatePropertyDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(PropertyType)
  type: PropertyType;

  @IsNumber()
  @Type(() => Number)
  latitude: number;

  @IsNumber()
  @Type(() => Number)
  longitude: number;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsArray()
  amenities: string[];

  @IsArray()
  imageUrls: string[];

  @IsNumber()
  @Type(() => Number)
  basePrice: number;
}
