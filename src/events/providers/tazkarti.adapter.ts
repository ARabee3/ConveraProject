import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IEventProviderAdapter, ExternalEvent } from './adapter.interface';

interface TazkartiEventRaw {
  id?: string | number;
  externalEventId?: string;
  title: string;
  description?: string;
  date: string | number | Date;
  latitude?: string | number;
  locationLat?: string | number;
  longitude?: string | number;
  locationLng?: string | number;
  address?: string;
  price?: string | number;
  category?: { name: string };
  categoryName?: string;
  coverImage?: string;
  cover_image?: string;
  galleryImages?: string[];
  gallery_images?: string[];
  maxCapacity?: string | number;
  max_capacity?: string | number;
  minAge?: string | number;
  ticketTypes?: string[];
  ticket_types?: string[];
  specialRequirements?: string;
  special_requirements?: string;
}

@Injectable()
export class TazkartiAdapter implements IEventProviderAdapter {
  readonly providerName = 'Tazkarti';

  constructor(private readonly configService: ConfigService) {}

  async fetchEvents(): Promise<ExternalEvent[]> {
    const apiKey = this.configService.get<string>('TAZKARTI_API_KEY') ?? '';
    const apiUrl = this.configService.get<string>(
      'TAZKARTI_API_URL',
      'https://api.tazkarti.com/events',
    );

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Tazkarti API error: ${response.status.toString()}`);
    }

    const data = (await response.json()) as unknown;
    return this.mapToExternalEvents(data);
  }

  private mapToExternalEvents(data: unknown): ExternalEvent[] {
    if (!Array.isArray(data)) {
      return [];
    }

    const items = data as TazkartiEventRaw[];

    return items.map((item) => ({
      externalEventId: (item.id?.toString() ?? item.externalEventId) || '',
      title: item.title,
      description: item.description || '',
      date: new Date(item.date),
      locationLat: parseFloat(String(item.latitude || item.locationLat || 0)),
      locationLng: parseFloat(String(item.longitude || item.locationLng || 0)),
      address: item.address || '',
      price: parseFloat(String(item.price || 0)),
      categoryName: item.category?.name || item.categoryName || 'General',
      coverImage: item.coverImage || item.cover_image || '',
      galleryImages: item.galleryImages || item.gallery_images || [],
      maxCapacity: parseInt(String(item.maxCapacity || item.max_capacity || '100'), 10),
      minAge: item.minAge ? parseInt(String(item.minAge), 10) : undefined,
      ticketTypes: item.ticketTypes || item.ticket_types,
      specialRequirements: item.specialRequirements || item.special_requirements,
    }));
  }
}
