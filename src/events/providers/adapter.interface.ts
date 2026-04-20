export interface ExternalEvent {
  externalEventId: string;
  title: string;
  description: string;
  date: Date;
  locationLat: number;
  locationLng: number;
  address: string;
  price: number;
  categoryName: string;
  coverImage: string;
  galleryImages: string[];
  maxCapacity: number;
  minAge?: number;
  ticketTypes?: string[];
  specialRequirements?: string;
}

export interface IEventProviderAdapter {
  readonly providerName: string;
  fetchEvents(): Promise<ExternalEvent[]>;
}
