import { IsString, IsInt, IsOptional, Min, Max, MinLength, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReviewDto {
  @IsUUID()
  bookingId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating: number;

  @IsOptional()
  @IsString()
  @MinLength(5)
  comment?: string;
}
