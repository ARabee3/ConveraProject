import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * US3 — Submit a review.
   *
   * Rules enforced:
   *  1. The property must exist and be active.
   *  2. The booking (bookingId) must exist — stub: we verify it is a valid UUID
   *     and that no review already exists for it (future: join with BookingModule).
   *  3. A user can only submit one review per booking.
   */
  async createReview(propertyId: string, userId: string, dto: CreateReviewDto) {
    // 1. Confirm property exists
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, isActive: true },
    });
    if (!property) throw new NotFoundException('Property not found.');

    // 2. Guard against duplicate review for the same booking
    const existing = await this.prisma.review.findUnique({
      where: { bookingId: dto.bookingId },
    });
    if (existing) {
      throw new ConflictException('A review for this booking already exists.');
    }

    // 3. Create the review
    return this.prisma.review.create({
      data: {
        propertyId,
        userId,
        bookingId: dto.bookingId,
        rating: dto.rating,
        comment: dto.comment ?? null,
      },
    });
  }
}
