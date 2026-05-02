import { IsOptional, IsUUID, IsInt, Min, Max, IsIn, IsString } from 'class-validator';

export class AdminPropertyQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  @IsOptional()
  @IsIn(['active', 'hidden', 'removed'])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
