import { IsIn, IsString, ValidateIf } from 'class-validator';

export class ChangeUserStatusDto {
  @IsIn(['active', 'suspended'])
  status: string;

  @ValidateIf((o: { status: string }) => o.status === 'suspended')
  @IsString()
  reason?: string;
}
