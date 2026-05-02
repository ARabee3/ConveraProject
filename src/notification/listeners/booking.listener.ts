import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationService } from '../notification.service';
import { NotificationType, Prisma } from '@prisma/client';
import { BookingConfirmedEvent } from '../../booking/events/booking-confirmed.event';
import { BookingCancelledEvent } from '../../booking/events/booking-cancelled.event';
import { BookingModifiedEvent } from '../../booking/events/booking-modified.event';

@Injectable()
export class BookingListener {
  private readonly logger = new Logger(BookingListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  @OnEvent('booking.confirmed')
  async handleBookingConfirmed(event: BookingConfirmedEvent) {
    this.logger.log({ message: 'Booking confirmed event received', bookingId: event.bookingId });

    const booking = await this.prisma.booking.findUnique({
      where: { id: event.bookingId },
      include: { property: { include: { host: true } }, customer: true },
    });

    if (!booking) {
      this.logger.error({ message: 'Booking not found', bookingId: event.bookingId });
      return;
    }

    const context = this.buildConfirmationContext(booking);

    // Notify customer
    await this.notificationService.create(
      NotificationType.BOOKING_CONFIRMATION,
      booking.customerId,
      'booking',
      booking.id,
      context,
    );

    // Notify host
    await this.notificationService.create(
      NotificationType.BOOKING_CONFIRMATION,
      booking.property.hostId,
      'booking',
      booking.id,
      context,
    );
  }

  @OnEvent('booking.cancelled')
  async handleBookingCancelled(event: BookingCancelledEvent) {
    this.logger.log({ message: 'Booking cancelled event received', bookingId: event.bookingId });

    const booking = await this.prisma.booking.findUnique({
      where: { id: event.bookingId },
      include: { property: { include: { host: true } }, customer: true },
    });

    if (!booking) {
      this.logger.error({ message: 'Booking not found', bookingId: event.bookingId });
      return;
    }

    const context = this.buildCancellationContext(booking, event.reason);

    await this.notificationService.create(
      NotificationType.BOOKING_CANCELLATION,
      booking.customerId,
      'booking',
      booking.id,
      context,
    );

    await this.notificationService.create(
      NotificationType.BOOKING_CANCELLATION,
      booking.property.hostId,
      'booking',
      booking.id,
      context,
    );
  }

  @OnEvent('booking.modified')
  async handleBookingModified(event: BookingModifiedEvent) {
    this.logger.log({ message: 'Booking modified event received', bookingId: event.bookingId });

    const booking = await this.prisma.booking.findUnique({
      where: { id: event.bookingId },
      include: { property: { include: { host: true } }, customer: true },
    });

    if (!booking) {
      this.logger.error({ message: 'Booking not found', bookingId: event.bookingId });
      return;
    }

    const context = {
      propertyName: booking.property.title,
      updatedCheckIn: event.startDate.toISOString(),
      updatedCheckOut: event.endDate.toISOString(),
      updatedTotal: event.totalPrice,
      referenceNumber: booking.id,
      hostName: booking.property.host.email,
      customerName: booking.customer.email,
    };

    await this.notificationService.create(
      NotificationType.BOOKING_MODIFICATION,
      booking.customerId,
      'booking',
      booking.id,
      context,
    );

    await this.notificationService.create(
      NotificationType.BOOKING_MODIFICATION,
      booking.property.hostId,
      'booking',
      booking.id,
      context,
    );
  }

  private buildConfirmationContext(
    booking: Prisma.BookingGetPayload<{
      include: { property: { include: { host: true } }; customer: true };
    }>,
  ) {
    return {
      propertyName: booking.property.title,
      checkInDate: booking.startDate.toISOString(),
      checkOutDate: booking.endDate.toISOString(),
      guestCount: 1, // Not stored in current schema; defaulting
      totalAmount: Number(booking.totalPrice),
      referenceNumber: booking.id,
      hostName: booking.property.host.email,
      customerName: booking.customer.email,
    };
  }

  private buildCancellationContext(
    booking: Prisma.BookingGetPayload<{
      include: { property: { include: { host: true } }; customer: true };
    }>,
    reason: string,
  ) {
    return {
      propertyName: booking.property.title,
      cancellationReference: booking.id,
      originalDates: `${booking.startDate.toISOString()} - ${booking.endDate.toISOString()}`,
      refundAmount: Number(booking.totalPrice),
      customerName: booking.customer.email,
      reason,
    };
  }
}
