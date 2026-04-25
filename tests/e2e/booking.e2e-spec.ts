import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { Server } from 'http';
import { BookingStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

describe('BookingController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let httpServer: Server;
  let accessToken: string;
  let propertyId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

    // Create a test user
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const user = await prismaService.user.create({
      data: {
        email: 'booking-test@example.com',
        passwordHash: hashedPassword,
        role: 'CUSTOMER',
        isVerified: true,
      },
    });

    // Create a test property
    const property = await prismaService.property.create({
      data: {
        hostId: user.id,
        title: 'Test Property',
        description: 'A test property for bookings',
        type: 'APARTMENT',
        latitude: 30.0444,
        longitude: 31.2357,
        address: 'Test Address',
        amenities: [],
        imageUrls: [],
        basePrice: 100,
        isActive: true,
      },
    });
    propertyId = property.id;

    // Login to get access token
    // Note: In a real scenario we'd use the auth service, but for simplicity we rely on the auth module
    // For these tests, we'll create a custom JWT or mock the guard if needed
    // Since we need a valid token, let's use the auth controller directly
    // Verify the user via DB since we can't get OTP easily in e2e
    await prismaService.user.update({
      where: { email: 'booking-test@example.com' },
      data: { isVerified: true },
    });

    const loginResponse = await request(httpServer).post('/auth/login').send({
      email: 'booking-test@example.com',
      password: 'Password123!',
    });

    accessToken = (loginResponse.body as { data: { accessToken: string } }).data.accessToken;
  });

  afterAll(async () => {
    await prismaService.transaction.deleteMany();
    await prismaService.booking.deleteMany();
    await prismaService.property.deleteMany();
    await prismaService.user.deleteMany();
    await app.close();
  });

  describe('POST /bookings', () => {
    it('should create a booking successfully', async () => {
      const response = await request(httpServer)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          propertyId,
          startDate: '2026-06-01',
          endDate: '2026-06-05',
        })
        .expect(201);

      const body = response.body as {
        status: BookingStatus;
        totalPrice: number;
        propertyId: string;
      };
      expect(body.status).toBe(BookingStatus.PENDING_PAYMENT);
      expect(body.totalPrice).toBeDefined();
      expect(body.propertyId).toBe(propertyId);
    });

    it('should return 409 for overlapping bookings', async () => {
      // First booking
      await request(httpServer)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          propertyId,
          startDate: '2026-07-01',
          endDate: '2026-07-05',
        })
        .expect(201);

      // Second overlapping booking should fail
      await request(httpServer)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          propertyId,
          startDate: '2026-07-03',
          endDate: '2026-07-07',
        })
        .expect(409);
    });

    it('should return 400 for invalid dates', async () => {
      await request(httpServer)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          propertyId,
          startDate: '2026-08-05',
          endDate: '2026-08-01',
        })
        .expect(400);
    });
  });
});
