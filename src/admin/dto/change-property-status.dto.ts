import { IsIn, IsString, ValidateIf } from 'class-validator';

export class ChangePropertyStatusDto {
  @IsIn(['active', 'hidden', 'removed'])
  status: string;

  @ValidateIf((o: { status: string }) => o.status === 'removed')
  @IsString()
  reason?: string;
}
