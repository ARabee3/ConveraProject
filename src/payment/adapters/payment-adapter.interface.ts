export interface PaymentAdapter {
  initializePayment(
    bookingId: string,
    amount: number,
    currency: string,
  ): Promise<{
    providerRef: string;
    paymentUrl: string;
  }>;

  verifyWebhookSignature(
    payload: Buffer | string,
    signature: string,
    secret: string,
  ): boolean | Promise<boolean>;

  extractPaymentResult(payload: unknown): {
    success: boolean;
    providerRef: string;
    bookingId?: string;
  };
}
