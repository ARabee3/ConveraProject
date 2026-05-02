import { IsOptional, IsUUID, IsInt, Min, Max, IsEnum, IsIn, IsString } from 'class-validator';
import { Role } from '@prisma/client';

export class AdminUserQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
