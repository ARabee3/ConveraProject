import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { StorageService } from '../common/storage/storage.service';
import { SearchEventsDto } from './dto/search-events.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { IEventProviderAdapter, ExternalEvent } from './providers/adapter.interface';
import { EventStatus, Prisma } from '@prisma/client';

export interface EventSearchResult {
  id: string;
  title: string;
  date: Date;
  address: string;
  price: number;
  coverImage: string;
  category: { id: string; name: string };
  remainingSpots: number;
  isSoldOut: boolean;
}

export interface EventDetailResult extends EventSearchResult {
  description: string;
  locationLat: number;
  locationLng: number;
  status: string;
  maxCapacity: number;
  galleryImages: { id: string; imageUrl: string; displayOrder: number }[];
  eligibility?: {
    minAge?: number;
    ticketTypes: string[];
    specialRequirements?: string;
  };
  source?: {
    sourceType: string;
    externalProviderName: string;
    externalEventId: string;
  };
}

type EventWithRelations = Prisma.EventGetPayload<{
  include: {
    category: { select: { id: true; name: true } };
    galleryImages: true;
    eligibility: true;
    source: true;
  };
}>;

@Injectable()
export class EventsService {
  private adapters: IEventProviderAdapter[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storageService: StorageService,
  ) {}

  registerProviderAdapter(adapter: IEventProviderAdapter) {
    this.adapters.push(adapter);
  }

  async create(dto: CreateEventDto): Promise<EventDetailResult> {
    const { eligibility, galleryImages, ...eventData } = dto;

    const event = await this.prisma.event.create({
      data: {
        ...eventData,
        remainingSpots: dto.maxCapacity,
        status: EventStatus.ACTIVE,
        eligibility: eligibility
          ? {
              create: {
                minAge: eligibility.minAge,
                ticketTypes: eligibility.ticketTypes,
                specialRequirements: eligibility.specialRequirements,
              },
            }
          : undefined,
        galleryImages:
          galleryImages && galleryImages.length > 0
            ? {
                create: galleryImages.map((img) => ({
                  imageUrl: img.imageUrl,
                  displayOrder: img.displayOrder,
                })),
              }
            : undefined,
      },
      include: {
        category: { select: { id: true, name: true } },
        galleryImages: { orderBy: { displayOrder: 'asc' } },
        eligibility: true,
        source: true,
      },
    });

    await this.redis.delByPattern('events:*');

    return this.mapToDetailResult(event as EventWithRelations);
  }

  async update(id: string, dto: UpdateEventDto): Promise<EventDetailResult> {
    const existing = await this.prisma.event.findUnique({
      where: { id },
      include: { eligibility: true },
    });

    if (!existing) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    const { eligibility, galleryImages, ...eventData } = dto;

    const updated = await this.prisma.event.update({
      where: { id },
      data: {
        ...eventData,
        eligibility: eligibility
          ? {
              upsert: {
                create: {
                  minAge: eligibility.minAge,
                  ticketTypes: eligibility.ticketTypes || [],
                  specialRequirements: eligibility.specialRequirements,
                },
                update: {
                  minAge: eligibility.minAge,
                  ticketTypes: eligibility.ticketTypes ?? [],
                  specialRequirements: eligibility.specialRequirements,
                },
              },
            }
          : undefined,
        galleryImages: galleryImages
          ? {
              deleteMany: {},
              create: galleryImages.map((img) => ({
                imageUrl: img.imageUrl,
                displayOrder: img.displayOrder,
              })),
            }
          : undefined,
      },
      include: {
        category: { select: { id: true, name: true } },
        galleryImages: { orderBy: { displayOrder: 'asc' } },
        eligibility: true,
        source: true,
      },
    });

    await this.redis.delByPattern('events:*');

    return this.mapToDetailResult(updated as EventWithRelations);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Event with ID ${id} not found`);
    }

    await this.prisma.event.delete({ where: { id } });
    await this.redis.delByPattern('events:*');
  }

  private mapToDetailResult(event: EventWithRelations): EventDetailResult {
    const result: EventDetailResult = {
      id: event.id,
      title: event.title,
      description: event.description,
      date: event.date,
      address: event.address,
      price: Number(event.price),
      coverImage: event.coverImage,
      category: event.category,
      remainingSpots: event.remainingSpots,
      isSoldOut: event.remainingSpots <= 0,
      locationLat: event.locationLat,
      locationLng: event.locationLng,
      status: event.status,
      maxCapacity: event.maxCapacity,
      galleryImages: event.galleryImages.map((g) => ({
        id: g.id,
        imageUrl: g.imageUrl,
        displayOrder: g.displayOrder,
      })),
    };

    if (event.eligibility) {
      result.eligibility = {
        minAge: event.eligibility.minAge ?? undefined,
        ticketTypes: event.eligibility.ticketTypes as string[],
        specialRequirements: event.eligibility.specialRequirements ?? undefined,
      };
    }

    if (event.source) {
      result.source = {
        sourceType: event.source.sourceType,
        externalProviderName: event.source.externalProviderName,
        externalEventId: event.source.externalEventId,
      };
    }

    return result;
  }

  async searchEvents(
    dto: SearchEventsDto,
  ): Promise<{ events: EventSearchResult[]; nextCursor: string | null }> {
    const cacheKey = `events:search:${JSON.stringify(dto)}`;
    const cached = await this.redis.get<{ events: EventSearchResult[]; nextCursor: string | null }>(
      cacheKey,
    );
    if (cached) {
      return cached;
    }

    const limit = dto.limit || 20;
    const now = new Date();

    const where: Prisma.EventWhereInput = {
      status: 'ACTIVE',
      date: { gt: now },
    };

    if (dto.categoryId) {
      where.categoryId = dto.categoryId;
    }

    if (dto.date) {
      const searchDate = new Date(dto.date);
      where.date = {
        gte: searchDate,
        lt: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    if (dto.lat !== undefined && dto.lng !== undefined && dto.radius !== undefined) {
      const radiusKm = dto.radius;
      const latDelta = radiusKm / 111;
      const lngDelta = radiusKm / (111 * Math.cos((dto.lat * Math.PI) / 180));
      where.locationLat = {
        gte: dto.lat - latDelta,
        lte: dto.lat + latDelta,
      };
      where.locationLng = {
        gte: dto.lng - lngDelta,
        lte: dto.lng + lngDelta,
      };
    }

    if (dto.priceMin !== undefined || dto.priceMax !== undefined) {
      where.price = {};
      if (dto.priceMin !== undefined) {
        where.price.gte = dto.priceMin;
      }
      if (dto.priceMax !== undefined) {
        where.price.lte = dto.priceMax;
      }
    }

    const events = await this.prisma.event.findMany({
      where,
      take: limit + 1,
      cursor: dto.cursor ? { id: dto.cursor } : undefined,
      skip: dto.cursor ? 1 : 0,
      include: {
        category: { select: { id: true, name: true } },
        eligibility: true,
      },
      orderBy: { date: 'asc' },
    });

    let filteredEvents = events;
    if (dto.minAge !== undefined) {
      const minAgeLimit = dto.minAge;
      filteredEvents = filteredEvents.filter((e) => {
        if (!e.eligibility) return true;
        const eventMinAge = e.eligibility.minAge;

        return eventMinAge === null || eventMinAge <= minAgeLimit;
      });
    }

    if (dto.ticketTypes && dto.ticketTypes.length > 0) {
      const searchTicketTypes = dto.ticketTypes;
      filteredEvents = filteredEvents.filter((e) => {
        if (!e.eligibility?.ticketTypes) return false;
        const eventTicketTypes = e.eligibility.ticketTypes as string[];
        return searchTicketTypes.some((t) => eventTicketTypes.includes(t));
      });
    }

    const hasMore = events.length > limit;
    const results = hasMore ? filteredEvents.slice(0, -1) : filteredEvents.slice(0, limit);
    const nextCursor = hasMore && results.length > 0 ? results[results.length - 1].id : null;

    const response: { events: EventSearchResult[]; nextCursor: string | null } = {
      events: results.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        address: e.address,
        price: Number(e.price),
        coverImage: e.coverImage,
        category: e.category,
        remainingSpots: e.remainingSpots,
        isSoldOut: e.remainingSpots <= 0,
      })),
      nextCursor,
    };

    await this.redis.set(cacheKey, response, 300);

    return response;
  }

  async getEventById(id: string): Promise<EventDetailResult | null> {
    const cacheKey = `events:detail:${id}`;
    const cached = await this.redis.get<EventDetailResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const event = await this.prisma.event.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        galleryImages: { orderBy: { displayOrder: 'asc' } },
        eligibility: true,
        source: true,
      },
    });

    if (!event) {
      return null;
    }

    const result = this.mapToDetailResult(event as EventWithRelations);
    await this.redis.set(cacheKey, result, 600);

    return result;
  }

  async importEvents(): Promise<{ imported: number; updated: number }> {
    let imported = 0;
    let updated = 0;

    for (const adapter of this.adapters) {
      const externalEvents = await adapter.fetchEvents();

      for (const event of externalEvents) {
        const result = await this.processExternalEvent(adapter.providerName, event);
        if (result.isNew) {
          imported++;
        } else {
          updated++;
        }
      }
    }

    await this.redis.delByPattern('events:*');

    return { imported, updated };
  }

  private async processExternalEvent(
    providerName: string,
    externalEvent: ExternalEvent,
  ): Promise<{ isNew: boolean }> {
    const existingSource = await this.prisma.eventSource.findFirst({
      where: {
        externalProviderName: providerName,
        externalEventId: externalEvent.externalEventId,
      },
    });

    let category = await this.prisma.eventCategory.findFirst({
      where: { name: externalEvent.categoryName },
    });

    if (!category) {
      category = await this.prisma.eventCategory.create({
        data: {
          name: externalEvent.categoryName,
          description: '',
        },
      });
    }

    const coverImageUrl = await this.uploadImage(
      externalEvent.coverImage,
      externalEvent.externalEventId,
      'cover',
    );
    const galleryImageUrls = await Promise.all(
      externalEvent.galleryImages
        .slice(0, 5)
        .map((url, index) =>
          this.uploadImage(url, externalEvent.externalEventId, `gallery-${String(index)}`),
        ),
    );

    if (existingSource) {
      await this.prisma.event.update({
        where: { id: existingSource.eventId },
        data: {
          title: externalEvent.title,
          description: externalEvent.description,
          date: externalEvent.date,
          locationLat: externalEvent.locationLat,
          locationLng: externalEvent.locationLng,
          address: externalEvent.address,
          price: externalEvent.price,
          categoryId: category.id,
          coverImage: coverImageUrl,
          maxCapacity: externalEvent.maxCapacity,
          remainingSpots: externalEvent.maxCapacity,
        },
      });
      return { isNew: false };
    }

    await this.prisma.event.create({
      data: {
        title: externalEvent.title,
        description: externalEvent.description,
        date: externalEvent.date,
        locationLat: externalEvent.locationLat,
        locationLng: externalEvent.locationLng,
        address: externalEvent.address,
        price: externalEvent.price,
        categoryId: category.id,
        coverImage: coverImageUrl,
        maxCapacity: externalEvent.maxCapacity,
        remainingSpots: externalEvent.maxCapacity,
        source: {
          create: {
            externalProviderName: providerName,
            externalEventId: externalEvent.externalEventId,
            sourceType: 'EXTERNAL',
          },
        },
        eligibility:
          externalEvent.minAge || externalEvent.ticketTypes
            ? {
                create: {
                  minAge: externalEvent.minAge,
                  ticketTypes: externalEvent.ticketTypes || [],
                  specialRequirements: externalEvent.specialRequirements,
                },
              }
            : undefined,
        galleryImages:
          galleryImageUrls.length > 0
            ? {
                create: galleryImageUrls.map((url, index) => ({
                  imageUrl: url,
                  displayOrder: index,
                })),
              }
            : undefined,
      },
    });

    return { isNew: true };
  }

  private async uploadImage(imageUrl: string, eventId: string, imageType: string): Promise<string> {
    if (!imageUrl) {
      return '';
    }

    try {
      const key = `events/${eventId}/${imageType}`;
      return await this.storageService.uploadFromUrl(imageUrl, key);
    } catch (error) {
      console.error(`Failed to upload image ${imageUrl} to Cloudinary:`, error);
      return imageUrl;
    }
  }
}
