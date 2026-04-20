import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';
import { SearchEventsDto } from './dto/search-events.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async searchEvents(@Query() dto: SearchEventsDto) {
    return this.eventsService.searchEvents(dto);
  }

  @Get(':id')
  async getEventById(@Param('id') id: string) {
    const event = await this.eventsService.getEventById(id);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    return event;
  }
}
