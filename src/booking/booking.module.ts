import { Module } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { BookingProcessor } from './booking.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'booking-expiration',
    }),
  ],
  controllers: [BookingController],
  providers: [BookingService, BookingProcessor],
  exports: [BookingService],
})
export class BookingModule {}
