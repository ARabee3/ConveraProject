export class BookingConfirmedEvent {
  constructor(
    public readonly bookingId: string,
    public readonly propertyId: string,
    public readonly customerId: string,
  ) {}
}
