export class BookingCancelledEvent {
  constructor(
    public readonly bookingId: string,
    public readonly reason: string,
  ) {}
}
