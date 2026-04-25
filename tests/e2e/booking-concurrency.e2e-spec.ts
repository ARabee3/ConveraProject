import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { Server } from 'http';

describe('Booking Concurrency (e2e)', () => {
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

    // Register and verify user
    await request(httpServer).post('/auth/register').send({
      email: 'concurrency-test@example.com',
      password: 'Password123!',
    });

    await prismaService.user.update({
      where: { email: 'concurrency-test@example.com' },
      data: { isVerified: true },
    });

    const loginResponse = await request(httpServer).post('/auth/login').send({
      email: 'concurrency-test@example.com',
      password: 'Password123!',
    });

    accessToken = (loginResponse.body as { data: { accessToken: string } }).data.accessToken;
    const customerId = (loginResponse.body as { data: { user: { id: string } } }).data.user.id;

    // Create a property
    const property = await prismaService.property.create({
      data: {
        hostId: customerId,
        title: 'Concurrency Test Property',
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

    propertyId = property.id;
  });

  afterAll(async () => {
    await prismaService.transaction.deleteMany();
    await prismaService.booking.deleteMany();
    await prismaService.property.deleteMany();
    await prismaService.user.deleteMany();
    await app.close();
  });

  it('should allow only one concurrent booking for the same dates', async () => {
    const payload = {
      propertyId,
      startDate: '2026-10-01',
      endDate: '2026-10-05',
    };

    // Fire two booking requests simultaneously
    const [res1, res2] = await Promise.all([
      request(httpServer)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(payload),
      request(httpServer)
        .post('/bookings')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(payload),
    ]);

    const statuses = [res1.status, res2.status];
    const successCount = statuses.filter((s) => s === 201).length;
    const conflictCount = statuses.filter((s) => s === 409).length;

    // Exactly one should succeed and one should fail with 409
    expect(successCount).toBe(1);
    expect(conflictCount).toBe(1);
  });
});
