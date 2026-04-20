import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventsService } from './events.service';

@Injectable()
export class EventsScheduler {
  constructor(private readonly eventsService: EventsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleEventImport() {
    await this.eventsService.importEvents();
  }
}
