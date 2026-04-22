import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PaymentAdapter } from './payment-adapter.interface';

@Injectable()
export class StripeAdapter implements PaymentAdapter {
  private readonly stripe: InstanceType<typeof Stripe>;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2026-03-25.dahlia',
    });
  }

  async initializePayment(
    bookingId: string,
    amount: number,
    currency: string,
  ): Promise<{ providerRef: string; paymentUrl: string }> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to smallest currency unit
      currency: currency.toLowerCase(),
      metadata: { bookingId },
    });

    return {
      providerRef: paymentIntent.id,
      paymentUrl: paymentIntent.client_secret!,
    };
  }

  verifyWebhookSignature(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): boolean {
    try {
      this.stripe.webhooks.constructEvent(payload as Buffer, signature, secret);
      return true;
    } catch {
      return false;
    }
  }

  extractPaymentResult(payload: unknown): {
    success: boolean;
    providerRef: string;
    bookingId?: string;
  } {
    const event = payload as {
      type: string;
      data?: { object?: { id?: string; metadata?: { bookingId?: string } } };
    };
    const object = event.data?.object;

    return {
      success: event.type === 'payment_intent.succeeded',
      providerRef: object?.id || '',
      bookingId: object?.metadata?.bookingId,
    };
  }
}
