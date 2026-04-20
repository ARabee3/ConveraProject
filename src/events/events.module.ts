import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { EventsAdminController } from './events-admin.controller';
import { EventsScheduler } from './events.scheduler';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { StorageModule } from '../common/storage/storage.module';
import { TazkartiAdapter } from './providers/tazkarti.adapter';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), RedisModule, StorageModule],
  providers: [EventsService, EventsScheduler, TazkartiAdapter],
  controllers: [EventsController, EventsAdminController],
  exports: [EventsService],
})
export class EventsModule {}
