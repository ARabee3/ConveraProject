import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync, IsString, IsNumber, IsEnum } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment;

  @IsNumber()
  PORT: number;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  REDIS_URL: string;

  @IsString()
  STRIPE_SECRET_KEY: string;

  @IsString()
  STRIPE_WEBHOOK_SECRET: string;

  @IsString()
  PAYMOB_API_KEY: string;

  @IsString()
  PAYMOB_HMAC_SECRET: string;

  @IsNumber()
  RESERVATION_TTL_MINUTES: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      expandVariables: true,
    }),
  ],
})
export class AppConfigModule {}
