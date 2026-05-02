import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { getHttpUrl } from './utils';

const JWT_SECRET = 'fallback_secret';
process.env.JWT_SECRET = JWT_SECRET;

describe('ChatGateway Read Receipts (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let httpUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = app.get<PrismaService>(PrismaService);
    await app.listen(0);
    httpUrl = getHttpUrl(app);
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

  async function createClient(userId: string): Promise<Socket> {
    const token = jwt.sign(
      { sub: userId, email: `${userId}@example.com`, role: 'CUSTOMER' },
      JWT_SECRET,
    );
    const client = io(`${httpUrl}/chat`, {
      transports: ['websocket'],
      auth: { token },
    });
    return new Promise<Socket>((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.disconnect();
        reject(new Error(`Client ${userId} connection timeout`));
      }, 3000);
      client.on('connect', () => {
        clearTimeout(timeout);
        resolve(client);
      });
      client.on('connect_error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  it('should broadcast read_receipt when mark_as_read is emitted', async () => {
    const { host, customer, property } = await seedData();
    const session = await prismaService.chatSession.create({
      data: {
        propertyId: property.id,
        customerId: customer.id,
      },
    });

    const sender = await createClient(customer.id);
    const receiver = await createClient(host.id);

    await new Promise<void>((resolve) => {
      sender.emit('subscribe', { sessionId: session.id }, () => {
        resolve();
      });
    });
    await new Promise<void>((resolve) => {
      receiver.emit('subscribe', { sessionId: session.id }, () => {
        resolve();
      });
    });

    // Create a message first
    const message = await prismaService.chatMessage.create({
      data: {
        sessionId: session.id,
        senderId: customer.id,
        content: 'Initial message',
      },
    });

    const receivedReceipts: Array<Record<string, unknown>> = [];
    sender.on('read_receipt', (data: Record<string, unknown>) => {
      receivedReceipts.push(data);
    });

    await new Promise<void>((resolve) => {
      receiver.emit('mark_as_read', { sessionId: session.id, lastMessageId: message.id }, () => {
        resolve();
      });
    });

    await new Promise<void>((resolve) => setTimeout(resolve, 500));

    expect(receivedReceipts.length).toBe(1);
    expect(receivedReceipts[0].sessionId).toBe(session.id);
    expect(receivedReceipts[0].lastReadMessageId).toBe(message.id);
    expect(receivedReceipts[0].readerId).toBe(host.id);

    sender.disconnect();
    receiver.disconnect();
  });
});
