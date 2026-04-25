import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { Server } from 'http';
import { BookingStatus, PaymentProvider, TransactionStatus } from '@prisma/client';
import { StripeAdapter } from '../../src/payment/adapters/stripe.adapter';

describe('Payment Webhooks (integration)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let httpServer: Server;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(StripeAdapter)
      .useValue({
        initializePayment: jest.fn().mockResolvedValue({
          providerRef: 'pi_test_123',
          paymentUrl: 'https://test.com/pay',
        }),
        verifyWebhookSignature: jest.fn().mockReturnValue(true),
        extractPaymentResult: jest
          .fn()
          .mockImplementation(
            (payload: {
              type?: string;
              data?: { object?: { id?: string; metadata?: { bookingId?: string } } };
            }) => {
              const data = payload.data?.object;
              return {
                success: payload.type === 'payment_intent.succeeded',
                providerRef: data?.id || '',
                bookingId: data?.metadata?.bookingId,
              };
            },
          ),
      })
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    prismaService = app.get<PrismaService>(PrismaService);

    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await prismaService.transaction.deleteMany();
    await prismaService.booking.deleteMany();
    await prismaService.property.deleteMany();
    await prismaService.user.deleteMany();
    await app.close();
  });

  describe('POST /payments/webhooks/stripe', () => {
    it('should confirm a booking on successful payment webhook', async () => {
      // Setup: create user, property, booking, and transaction
      const user = await prismaService.user.create({
        data: {
          email: 'webhook-test@example.com',
          passwordHash: 'hash',
          role: 'CUSTOMER',
          isVerified: true,
        },
      });

      const property = await prismaService.property.create({
        data: {
          hostId: user.id,
          title: 'Webhook Test Property',
          description: 'Test',
          type: 'APARTMENT',
          latitude: 30.0444,
          longitude: 31.2357,
          address: 'Test',
          amenities: [],
          imageUrls: [],
          basePrice: 100,
          isActive: true,
        },
      });

      const booking = await prismaService.booking.create({
        data: {
          propertyId: property.id,
          customerId: user.id,
          startDate: new Date('2026-09-01'),
          endDate: new Date('2026-09-05'),
          totalPrice: 400,
          status: BookingStatus.PENDING_PAYMENT,
        },
      });

      await prismaService.transaction.create({
        data: {
          bookingId: booking.id,
          amount: 400,
          currency: 'EGP',
          provider: PaymentProvider.STRIPE,
          providerRef: 'pi_test_123',
          status: TransactionStatus.INITIATED,
        },
      });

      const payload = {
        id: 'evt_test',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_123',
            metadata: { bookingId: booking.id },
          },
        },
      };

      await request(httpServer)
        .post('/payments/webhooks/stripe')
        .send(payload)
        .set('stripe-signature', 'test-signature')
        .expect(200);

      const updatedBooking = await prismaService.booking.findUnique({
        where: { id: booking.id },
      });

      expect(updatedBooking?.status).toBe(BookingStatus.CONFIRMED);
    });
  });
});
