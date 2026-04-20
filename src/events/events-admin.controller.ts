import { Controller, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { EventsService } from './events.service';
import { TazkartiAdapter } from './providers/tazkarti.adapter';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('admin/events')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EventsAdminController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly tazkartiAdapter: TazkartiAdapter,
  ) {
    this.eventsService.registerProviderAdapter(this.tazkartiAdapter);
  }

  @Post()
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  async create(@Body() dto: CreateEventDto) {
    return this.eventsService.create(dto);
  }

  @Put(':id')
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  async update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.eventsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  async delete(@Param('id') id: string) {
    return this.eventsService.delete(id);
  }

  @Post('import')
  @Roles('ADMIN', 'SYSTEM_ADMIN')
  async importEvents() {
    const result = await this.eventsService.importEvents();
    return {
      success: true,
      ...result,
    };
  }
}
