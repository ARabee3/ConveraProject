import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { LoggerModule } from 'nestjs-pino';
import { I18nModule, AcceptLanguageResolver, HeaderResolver } from 'nestjs-i18n';
import * as path from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AccommodationModule } from './accommodation/accommodation.module';
import { ReviewsModule } from './reviews/reviews.module';
import { EventsModule } from './events/events.module';
import { BookingModule } from './booking/booking.module';
import { PaymentModule } from './payment/payment.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    AccommodationModule,
    ReviewsModule,
    EventsModule,
    BookingModule,
    PaymentModule,
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('REDIS_HOST'),
          port: configService.get<number>('REDIS_PORT'),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== 'production' ? { target: 'pino-pretty' } : undefined,
      },
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(__dirname, '/i18n/'),
        watch: true,
      },
      resolvers: [new HeaderResolver(['x-custom-lang']), AcceptLanguageResolver],
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
