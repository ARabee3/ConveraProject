import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AccommodationService } from './accommodation.service';
import { SearchPropertiesDto } from './dto/search-properties.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

interface AuthRequest extends Request {
  user: { id: string; role: Role };
}

// ─── Public Endpoints (US1 & US3) ───────────────────────────────────────────

@Controller('properties')
export class AccommodationController {
  constructor(private readonly accommodationService: AccommodationService) {}

  /** US1 — Browse & search all active properties */
  @Get()
  searchProperties(@Query() filters: SearchPropertiesDto) {
    return this.accommodationService.searchProperties(filters);
  }

  /** US3 — Get full property details including reviews */
  @Get(':id')
  getPropertyDetails(@Param('id') id: string) {
    return this.accommodationService.getPropertyDetails(id);
  }
}

// ─── Host-Scoped Endpoints (US2) ────────────────────────────────────────────

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.HOST)
@Controller('host/properties')
export class HostAccommodationController {
  constructor(private readonly accommodationService: AccommodationService) {}

  /** US2 — List my properties */
  @Get()
  getMyProperties(@Request() req: AuthRequest) {
    return this.accommodationService.getHostProperties(req.user.id);
  }

  /** US2 — Create a new property listing */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createProperty(@Request() req: AuthRequest, @Body() dto: CreatePropertyDto) {
    return this.accommodationService.createProperty(req.user.id, dto);
  }

  /** US2 — Update an existing property */
  @Patch(':id')
  updateProperty(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.accommodationService.updateProperty(id, req.user.id, dto);
  }

  /** US2 — Soft-delete (deactivate) a property */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProperty(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.accommodationService.deleteProperty(id, req.user.id);
  }

  /** US2 — Set availability override (block or price override) */
  @Post(':id/availability')
  @HttpCode(HttpStatus.CREATED)
  setAvailability(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.accommodationService.setAvailability(id, req.user.id, dto);
  }
}
