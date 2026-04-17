import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'email must be an email' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'password is too weak' })
  password!: string;
}
