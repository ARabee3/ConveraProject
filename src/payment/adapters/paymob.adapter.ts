import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentAdapter } from './payment-adapter.interface';
import * as crypto from 'crypto';

interface PaymobPayload {
  success?: boolean;
  type?: string;
  bookingId?: string;
  order?: { id?: string };
  obj?: { id?: string };
}

@Injectable()
export class PaymobAdapter implements PaymentAdapter {
  constructor(private readonly configService: ConfigService) {}

  initializePayment(bookingId: string): Promise<{ providerRef: string; paymentUrl: string }> {
    // Simplified Paymob flow: returns a placeholder payment URL
    // In production, this would call Paymob's auth/order/payment-key APIs
    const providerRef = `paymob_${bookingId}_${Date.now().toString()}`;
    return Promise.resolve({
      providerRef,
      paymentUrl: `https://accept.paymob.com/api/acceptance/iframes/PLACEHOLDER?payment_token=${providerRef}`,
    });
  }

  verifyWebhookSignature(payload: Buffer | string, signature: string, secret: string): boolean {
    const hmac = crypto.createHmac('sha512', secret);
    hmac.update(payload as string);
    const digest = hmac.digest('hex');
    return crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(signature, 'hex'));
  }

  extractPaymentResult(payload: unknown): {
    success: boolean;
    providerRef: string;
    bookingId?: string;
  } {
    const data = payload as PaymobPayload;
    return {
      success: data.success === true || data.type === 'TRANSACTION_SUCCESS',
      providerRef: data.order?.id || data.obj?.id || '',
      bookingId: data.bookingId,
    };
  }
}
