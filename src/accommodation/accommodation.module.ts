import { Module } from '@nestjs/common';
import { AccommodationService } from './accommodation.service';
import { AccommodationController, HostAccommodationController } from './accommodation.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [AccommodationService],
  controllers: [AccommodationController, HostAccommodationController],
  exports: [AccommodationService],
})
export class AccommodationModule {}
