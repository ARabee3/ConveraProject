import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SearchPropertiesDto } from './dto/search-properties.dto';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { UpdateAvailabilityDto } from './dto/update-availability.dto';

@Injectable()
export class AccommodationService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── US1: Search / Browse ────────────────────────────────────────────────

  async searchProperties(filters: SearchPropertiesDto) {
    const { lat, lng, radius, priceMin, priceMax, checkIn, checkOut, ratingMin } = filters;

    const where: Prisma.PropertyWhereInput = { isActive: true };

    if (priceMin !== undefined || priceMax !== undefined) {
      where.basePrice = {
        ...(priceMin !== undefined ? { gte: priceMin } : {}),
        ...(priceMax !== undefined ? { lte: priceMax } : {}),
      };
    }

    // Exclude properties that have availability overrides (BLOCKED) overlapping the requested dates
    if (checkIn && checkOut) {
      where.availabilityOverrides = {
        none: {
          status: 'BLOCKED',
          startDate: { lte: new Date(checkOut) },
          endDate: { gte: new Date(checkIn) },
        },
      };
    }

    const properties = await this.prisma.property.findMany({
      where,
      select: {
        id: true,
        title: true,
        type: true,
        address: true,
        latitude: true,
        longitude: true,
        basePrice: true,
        imageUrls: true,
        reviews: {
          select: { rating: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute average rating and filter by ratingMin / radius in-memory
    return properties
      .map((p) => {
        const ratings = p.reviews.map((r) => r.rating);
        const avgRating =
          ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

        let distanceKm: number | null = null;
        if (lat !== undefined && lng !== undefined) {
          distanceKm = this.haversineKm(lat, lng, p.latitude, p.longitude);
        }

        return {
          id: p.id,
          title: p.title,
          type: p.type,
          address: p.address,
          latitude: p.latitude,
          longitude: p.longitude,
          basePrice: p.basePrice,
          imageUrls: p.imageUrls,
          avgRating,
          distanceKm,
        };
      })
      .filter((p) => {
        if (ratingMin !== undefined && (p.avgRating === null || p.avgRating < ratingMin))
          return false;
        if (radius !== undefined && p.distanceKm !== null && p.distanceKm > radius) return false;
        return true;
      });
  }

  // ─── US2: Host CRUD ──────────────────────────────────────────────────────

  async createProperty(hostId: string, dto: CreatePropertyDto) {
    return this.prisma.property.create({
      data: {
        hostId,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        latitude: dto.latitude,
        longitude: dto.longitude,
        address: dto.address,
        amenities: dto.amenities,
        imageUrls: dto.imageUrls,
        basePrice: dto.basePrice,
      },
    });
  }

  async updateProperty(propertyId: string, hostId: string, dto: UpdatePropertyDto) {
    const property = await this.findPropertyOrThrow(propertyId);
    this.assertHost(property, hostId);

    return this.prisma.property.update({
      where: { id: propertyId },
      data: dto,
    });
  }

  async deleteProperty(propertyId: string, hostId: string) {
    const property = await this.findPropertyOrThrow(propertyId);
    this.assertHost(property, hostId);

    // Soft-delete: mark inactive instead of physical deletion
    await this.prisma.property.update({
      where: { id: propertyId },
      data: { isActive: false },
    });
  }

  async setAvailability(propertyId: string, hostId: string, dto: UpdateAvailabilityDto) {
    const property = await this.findPropertyOrThrow(propertyId);
    this.assertHost(property, hostId);

    // Detect overlapping overrides for this property
    const overlapping = await this.prisma.availabilityOverride.findFirst({
      where: {
        propertyId,
        startDate: { lte: new Date(dto.endDate) },
        endDate: { gte: new Date(dto.startDate) },
      },
    });

    if (overlapping) {
      throw new ConflictException(
        'An availability override already exists for the given date range.',
      );
    }

    return this.prisma.availabilityOverride.create({
      data: {
        propertyId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        status: dto.status,
        overridePrice: dto.overridePrice ?? null,
      },
    });
  }

  async getHostProperties(hostId: string) {
    return this.prisma.property.findMany({
      where: { hostId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getHostBookedProperties(propertyId: string, hostId: string) {
    const property = await this.findPropertyOrThrow(propertyId);
    this.assertHost(property, hostId);
    return property;
  }

  // ─── US3: Property Details ───────────────────────────────────────────────

  async getPropertyDetails(propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, isActive: true },
      include: {
        reviews: {
          include: {
            user: { select: { id: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        availabilityOverrides: {
          orderBy: { startDate: 'asc' },
        },
      },
    });

    if (!property) throw new NotFoundException('Property not found.');
    return property;
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async findPropertyOrThrow(propertyId: string) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new NotFoundException('Property not found.');
    return property;
  }

  private assertHost(property: { hostId: string }, hostId: string) {
    if (property.hostId !== hostId) {
      throw new ForbiddenException('You do not have permission to modify this property.');
    }
  }

  /** Haversine formula — returns distance in km */
  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number) {
    return (deg * Math.PI) / 180;
  }
}
