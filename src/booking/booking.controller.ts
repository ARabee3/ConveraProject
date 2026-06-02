import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ConflictException,
  Param,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Role } from '@prisma/client';

interface AuthRequest extends Request {
  user: { id: string; role: Role };
}

@Controller('bookings')
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async findMyBookings(@Request() req: AuthRequest) {
    return this.bookingService.findByCustomer(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Request() req: AuthRequest, @Param('id') id: string) {
    return this.bookingService.findOne(id, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Request() req: AuthRequest, @Body() dto: CreateBookingDto) {
    try {
      return await this.bookingService.create(req.user.id, dto);
    } catch (err) {
      if (err instanceof ConflictException) {
        throw err;
      }
      throw err;
    }
  }
}
