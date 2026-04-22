import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StripeAdapter } from './adapters/stripe.adapter';
import { PaymobAdapter } from './adapters/paymob.adapter';
import { PaymentProvider, TransactionStatus } from '@prisma/client';

@Injectable()
export class PaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeAdapter: StripeAdapter,
    private readonly paymobAdapter: PaymobAdapter,
  ) {}

  async initializePayment(bookingId: string, provider: PaymentProvider) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (booking.status !== 'PENDING_PAYMENT') {
      throw new BadRequestException('Booking is not pending payment.');
    }

    const adapter = this.getAdapter(provider);
    const result = await adapter.initializePayment(
      bookingId,
      Number(booking.totalPrice),
      'EGP',
    );

    // Log transaction
    const transaction = await this.prisma.transaction.create({
      data: {
        bookingId,
        amount: booking.totalPrice,
        currency: 'EGP',
        provider,
        providerRef: result.providerRef,
        status: TransactionStatus.INITIATED,
      },
    });

    return {
      transactionId: transaction.id,
      providerRef: result.providerRef,
      paymentUrl: result.paymentUrl,
    };
  }

  async processWebhook(
    provider: PaymentProvider,
    payload: unknown,
    signature: string,
    rawBody?: string | Buffer,
  ): Promise<{ success: boolean; bookingId?: string }> {
    const adapter = this.getAdapter(provider);
    const secret = this.getWebhookSecret(provider);

    const isValid = await adapter.verifyWebhookSignature(
      rawBody || JSON.stringify(payload),
      signature,
      secret,
    );

    if (!isValid) {
      throw new BadRequestException('Invalid webhook signature.');
    }

    const result = adapter.extractPaymentResult(payload);

    if (!result.providerRef) {
      throw new BadRequestException('Invalid webhook payload.');
    }

    // Update transaction status
    const transaction = await this.prisma.transaction.findFirst({
      where: { providerRef: result.providerRef },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found.');
    }

    await this.prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: result.success ? TransactionStatus.SUCCESS : TransactionStatus.FAILED },
    });

    return { success: result.success, bookingId: result.bookingId || transaction.bookingId };
  }

  private getAdapter(provider: PaymentProvider) {
    switch (provider) {
      case PaymentProvider.STRIPE:
        return this.stripeAdapter;
      case PaymentProvider.PAYMOB:
        return this.paymobAdapter;
      default:
        throw new BadRequestException('Unsupported payment provider.');
    }
  }

  private getWebhookSecret(provider: PaymentProvider): string {
    switch (provider) {
      case PaymentProvider.STRIPE:
        return process.env.STRIPE_WEBHOOK_SECRET || '';
      case PaymentProvider.PAYMOB:
        return process.env.PAYMOB_HMAC_SECRET || '';
      default:
        return '';
    }
  }
}
