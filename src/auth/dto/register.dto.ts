import { IsEmail, IsString, Matches, MinLength, IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export class RegisterDto {
  @IsEmail({}, { message: 'email must be an email' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message: 'password too weak (must contain uppercase, lowercase, number and special character)',
  })
  password!: string;

  @IsOptional()
  @IsEnum(Role, { message: 'role must be CUSTOMER or HOST' })
  role?: Role = Role.CUSTOMER;
}
