import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });
  app.useLogger(app.get(Logger));

  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);

  // Hard fail on missing critical config
  const dbUrl = configService.get<string>('DATABASE_URL');
  const redisUrl = configService.get<string>('REDIS_URL');
  if (!dbUrl || !redisUrl) {
    console.error('CRITICAL: DATABASE_URL or REDIS_URL missing in environment. Exiting.');
    process.exit(1);
  }

  const port = configService.get<number>('PORT') ?? 3000;

  await app.listen(port);
}
bootstrap().catch((err: unknown) => {
  console.error('Error bootstrapping app', err);
  process.exit(1);
});
