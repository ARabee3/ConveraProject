import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

interface AuthRequest extends Request {
  user: { id: string; role: Role };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
@Controller('properties/:propertyId/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  /** US3 — Submit a review for a property (only verified customers with a booking) */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createReview(
    @Request() req: AuthRequest,
    @Param('propertyId') propertyId: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(propertyId, req.user.id, dto);
  }
}
