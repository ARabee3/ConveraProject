export class BookingModifiedEvent {
  constructor(
    public readonly bookingId: string,
    public readonly propertyId: string,
    public readonly customerId: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly totalPrice: number,
  ) {}
}
