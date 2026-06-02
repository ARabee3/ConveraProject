import { Controller, Get, Post, Param, Query, UseGuards, Request, NotFoundException } from '@nestjs/common';
import { EventsService } from './events.service';
import { SearchEventsDto } from './dto/search-events.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get('categories')
  async getCategories() {
    return this.eventsService.getCategories();
  }

  @Get()
  async searchEvents(@Query() dto: SearchEventsDto) {
    return this.eventsService.searchEvents(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/register')
  async registerForEvent(@Request() req: any, @Param('id') id: string) {
    return this.eventsService.registerForEvent(id, req.user.id);
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
