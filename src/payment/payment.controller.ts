import { Controller, Post, Body, Headers, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { BookingService } from '../booking/booking.service';
import { PaymentProvider } from '@prisma/client';
import * as express from 'express';

@Controller('payments')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly bookingService: BookingService,
  ) {}

  @Post('initialize')
  @HttpCode(HttpStatus.OK)
  async initializePayment(
    @Body('bookingId') bookingId: string,
    @Body('provider') provider: PaymentProvider,
  ) {
    return this.paymentService.initializePayment(bookingId, provider);
  }

  @Post('webhooks/stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: express.Request,
    @Body() payload: unknown,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = (req as unknown as { rawBody?: Buffer | string }).rawBody;
    const result = await this.paymentService.processWebhook(
      PaymentProvider.STRIPE,
      payload,
      signature,
      rawBody,
    );

    if (result.success && result.bookingId) {
      await this.bookingService.confirm(result.bookingId);
    } else if (result.bookingId) {
      await this.bookingService.cancel(result.bookingId, 'Payment failed');
    }

    return { received: true };
  }

  @Post('webhooks/paymob')
  @HttpCode(HttpStatus.OK)
  async handlePaymobWebhook(
    @Req() req: express.Request,
    @Body() payload: unknown,
    @Headers('hmac') signature: string,
  ) {
    const rawBody = (req as unknown as { rawBody?: Buffer | string }).rawBody;
    const result = await this.paymentService.processWebhook(
      PaymentProvider.PAYMOB,
      payload,
      signature || '',
      rawBody,
    );

    if (result.success && result.bookingId) {
      await this.bookingService.confirm(result.bookingId);
    } else if (result.bookingId) {
      await this.bookingService.cancel(result.bookingId, 'Payment failed');
    }

    return { received: true };
  }
}
