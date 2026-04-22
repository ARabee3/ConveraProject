import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { BookingModule } from '../booking/booking.module';
import { StripeAdapter } from './adapters/stripe.adapter';
import { PaymobAdapter } from './adapters/paymob.adapter';

@Module({
  imports: [PrismaModule, BookingModule],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    StripeAdapter,
    PaymobAdapter,
    {
      provide: 'PAYMENT_ADAPTERS',
      useFactory: (stripe: StripeAdapter, paymob: PaymobAdapter) => ({
        stripe,
        paymob,
      }),
      inject: [StripeAdapter, PaymobAdapter],
    },
  ],
  exports: [PaymentService],
})
export class PaymentModule {}
