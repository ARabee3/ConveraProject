import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BookingStatus } from '@prisma/client';
import { CreateBookingDto } from './dto/create-booking.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingCreatedEvent } from './events/booking-created.event';
import { BookingConfirmedEvent } from './events/booking-confirmed.event';
import { BookingCancelledEvent } from './events/booking-cancelled.event';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    @InjectQueue('booking-expiration') private readonly expirationQueue: Queue,
  ) {}

  // ─── US1: Create Booking ──────────────────────────────────────────────────

  async create(customerId: string, dto: CreateBookingDto) {
    const { propertyId, startDate, endDate } = dto;
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      throw new BadRequestException('endDate must be after startDate.');
    }

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: { availabilityOverrides: true },
    });

    if (!property || !property.isActive) {
      throw new NotFoundException('Property not found or inactive.');
    }

    // Check for blocked dates
    const blocked = property.availabilityOverrides.some(
      (ao) =>
        ao.status === 'BLOCKED' &&
        new Date(ao.startDate) < end &&
        new Date(ao.endDate) > start,
    );

    if (blocked) {
      throw new ConflictException('Property is not available for the selected dates.');
    }

    // Check for overlapping confirmed or pending bookings
    const overlappingBooking = await this.prisma.booking.findFirst({
      where: {
        propertyId,
        status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED] },
        startDate: { lt: end },
        endDate: { gt: start },
      },
    });

    if (overlappingBooking) {
      throw new ConflictException('Selected dates are already reserved.');
    }

    // Calculate total price
    const totalPrice = this.calculateTotalPrice(
      Number(property.basePrice),
      property.availabilityOverrides.map((ao) => ({
        startDate: ao.startDate,
        endDate: ao.endDate,
        status: ao.status,
        overridePrice: ao.overridePrice ? Number(ao.overridePrice) : null,
      })),
      start,
      end,
    );

    if (totalPrice <= 0) {
      throw new BadRequestException('totalPrice must be greater than 0.');
    }

    const booking = await this.prisma.$transaction(async (tx) => {
      // Lock the property row to prevent concurrent bookings for overlapping dates
      await tx.$queryRaw`SELECT id FROM properties WHERE id = ${propertyId} FOR UPDATE`;

      const overlapping = await tx.booking.findFirst({
        where: {
          propertyId,
          status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.CONFIRMED] },
          startDate: { lt: end },
          endDate: { gt: start },
        },
      });

      if (overlapping) {
        throw new ConflictException('Selected dates are already reserved.');
      }

      return tx.booking.create({
        data: {
          propertyId,
          customerId,
          startDate: start,
          endDate: end,
          totalPrice,
          status: BookingStatus.PENDING_PAYMENT,
        },
      });
    });

    // Schedule expiration job
    const ttlMinutes = this.configService.get<number>('RESERVATION_TTL_MINUTES', 15);
    await this.expirationQueue.add(
      'expire-booking',
      { bookingId: booking.id },
      { delay: ttlMinutes * 60 * 1000 },
    );

    // Emit domain event
    this.eventEmitter.emit(
      'booking.created',
      new BookingCreatedEvent(
        booking.id,
        booking.propertyId,
        booking.customerId,
        booking.startDate,
        booking.endDate,
        Number(booking.totalPrice),
      ),
    );

    return booking;
  }

  // ─── US2: Confirm / Cancel ────────────────────────────────────────────────

  async confirm(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (booking.status !== BookingStatus.PENDING_PAYMENT) {
      throw new ConflictException('Booking is not in a confirmable state.');
    }

    // Optimistic locking via updateMany with version
    const result = await this.prisma.client.booking.updateMany({
      where: { id: bookingId, version: booking.version },
      data: { status: BookingStatus.CONFIRMED },
    });

    if (result.count === 0) {
      throw new ConflictException('Booking was modified by another process. Please retry.');
    }

    const confirmedBooking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!confirmedBooking) {
      throw new NotFoundException('Booking not found after confirmation.');
    }

    this.eventEmitter.emit(
      'booking.confirmed',
      new BookingConfirmedEvent(
        confirmedBooking.id,
        confirmedBooking.propertyId,
        confirmedBooking.customerId,
      ),
    );

    return confirmedBooking;
  }

  async cancel(bookingId: string, reason: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return booking;
    }

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CANCELLED },
    });

    this.eventEmitter.emit(
      'booking.cancelled',
      new BookingCancelledEvent(bookingId, reason),
    );

    return this.prisma.booking.findUnique({ where: { id: bookingId } });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private calculateTotalPrice(
    basePrice: number,
    overrides: Array<{ startDate: Date; endDate: Date; status: string; overridePrice: number | null }>,
    start: Date,
    end: Date,
  ): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    const nights = Math.ceil((end.getTime() - start.getTime()) / msPerDay);
    let total = 0;

    for (let i = 0; i < nights; i++) {
      const currentDate = new Date(start.getTime() + i * msPerDay);
      const override = overrides.find(
        (ao) =>
          ao.status === 'PRICE_OVERRIDE' &&
          new Date(ao.startDate) <= currentDate &&
          new Date(ao.endDate) > currentDate,
      );
      total += override && override.overridePrice !== null
        ? Number(override.overridePrice)
        : Number(basePrice);
    }

    return total;
  }
}
