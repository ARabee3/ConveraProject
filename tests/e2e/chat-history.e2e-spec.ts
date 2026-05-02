import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const JWT_SECRET = 'fallback_secret';
process.env.JWT_SECRET = JWT_SECRET;

describe('ChatGateway History (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let httpServer: import('http').Server;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = app.get<PrismaService>(PrismaService);
    await app.init();
    httpServer = app.getHttpServer() as import('http').Server;
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await prismaService.chatMessage.deleteMany();
    await prismaService.chatSession.deleteMany();
    await prismaService.property.deleteMany();
    await prismaService.user.deleteMany();
  });

  async function seedData() {
    const host = await prismaService.user.create({
      data: {
        email: `host-${randomUUID()}@example.com`,
        passwordHash: 'hash',
        role: 'HOST',
        isVerified: true,
      },
    });

    const customer = await prismaService.user.create({
      data: {
        email: `customer-${randomUUID()}@example.com`,
        passwordHash: 'hash',
        role: 'CUSTOMER',
        isVerified: true,
      },
    });

    const property = await prismaService.property.create({
      data: {
        hostId: host.id,
        title: 'Test Property',
        description: 'Description',
        type: 'APARTMENT',
        latitude: 0,
        longitude: 0,
        address: 'Address',
        amenities: [],
        imageUrls: [],
        basePrice: 100,
      },
    });

    return { host, customer, property };
  }

  it('should allow members to retrieve chat history', async () => {
    const { customer, property } = await seedData();
    const session = await prismaService.chatSession.create({
      data: {
        propertyId: property.id,
        customerId: customer.id,
      },
    });

    await prismaService.chatMessage.create({
      data: {
        sessionId: session.id,
        senderId: customer.id,
        content: 'Hello history',
      },
    });

    const token = jwt.sign(
      { sub: customer.id, email: customer.email, role: customer.role },
      JWT_SECRET,
    );

    const response = await request(httpServer)
      .get(`/chat/${session.id}/history`)
      .set('Authorization', `Bearer ${token}`);

    const body = response.body as { data: Array<{ content: string }> };
    expect(response.status).toBe(200);
    expect(body.data.length).toBe(1);
    expect(body.data[0].content).toBe('Hello history');
  });

  it('should reject non-members from retrieving chat history', async () => {
    const { customer, property } = await seedData();

    // Some other user
    const otherUser = await prismaService.user.create({
      data: {
        email: `other-${randomUUID()}@example.com`,
        passwordHash: 'hash',
        role: 'CUSTOMER',
        isVerified: true,
      },
    });

    const session = await prismaService.chatSession.create({
      data: {
        propertyId: property.id,
        customerId: customer.id,
      },
    });

    const token = jwt.sign(
      { sub: otherUser.id, email: otherUser.email, role: otherUser.role },
      JWT_SECRET,
    );

    const response = await request(httpServer)
      .get(`/chat/${session.id}/history`)
      .set('Authorization', `Bearer ${token}`);

    const body = response.body as { message: string };
    expect(response.status).toBe(403);
    expect(body.message).toContain('Unauthorized');
  });
});
