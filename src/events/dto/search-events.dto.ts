import {
  IsOptional,
  IsNumber,
  Min,
  Max,
  IsDateString,
  IsUUID,
  IsInt,
  IsArray,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SearchEventsDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lng?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  radius?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceMax?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minAge?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ticketTypes?: string[];
}
