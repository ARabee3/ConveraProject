import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const JWT_SECRET = 'fallback_secret';
process.env.JWT_SECRET = JWT_SECRET;

describe('ChatGateway Message Exchange (e2e)', () => {
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
    httpUrl = `http://localhost:${(app.getHttpServer().address() as { port: number }).port}`;
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
    const token = jwt.sign({ sub: userId, email: `${userId}@example.com`, role: 'CUSTOMER' }, JWT_SECRET);
    const client = io(`${httpUrl}/chat`, {
      transports: ['websocket'],
      auth: { token },
    });
    return new Promise((resolve, reject) => {
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

  it('should allow two clients to exchange messages in the same room', async () => {
    const { host, customer, property } = await seedData();
    const session = await prismaService.chatSession.create({
      data: {
        propertyId: property.id,
        customerId: customer.id,
      },
    });

    const client1 = await createClient(customer.id);
    const client2 = await createClient(host.id);

    await new Promise<void>((resolve) => {
      client1.emit('subscribe', { sessionId: session.id }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      client2.emit('subscribe', { sessionId: session.id }, () => resolve());
    });

    const receivedMessages: Array<Record<string, unknown>> = [];
    client2.on('new_message', (msg: Record<string, unknown>) => {
      receivedMessages.push(msg);
    });

    await new Promise<void>((resolve) => {
      client1.emit('send_message', { sessionId: session.id, content: 'Hello from customer' }, () => resolve());
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(receivedMessages.length).toBe(1);
    expect(receivedMessages[0].content).toBe('Hello from customer');
    expect(receivedMessages[0].senderId).toBe(customer.id);

    client1.disconnect();
    client2.disconnect();
  });

  it('should not deliver messages to clients in different rooms', async () => {
    const { host, customer, property } = await seedData();
    
    const session1 = await prismaService.chatSession.create({
      data: { propertyId: property.id, customerId: customer.id },
    });

    // Create another host and property for session 2
    const host2 = await prismaService.user.create({
        data: { email: `host2-${randomUUID()}@example.com`, passwordHash: 'hash', role: 'HOST', isVerified: true }
    });
    const property2 = await prismaService.property.create({
        data: { hostId: host2.id, title: 'Prop 2', description: 'D', type: 'APARTMENT', latitude: 0, longitude: 0, address: 'A', amenities: [], imageUrls: [], basePrice: 100 }
    });
    const session2 = await prismaService.chatSession.create({
      data: { propertyId: property2.id, customerId: customer.id },
    });

    const client1 = await createClient(customer.id);
    const client2 = await createClient(host2.id);

    await new Promise<void>((resolve) => {
      client1.emit('subscribe', { sessionId: session1.id }, () => resolve());
    });
    await new Promise<void>((resolve) => {
      client2.emit('subscribe', { sessionId: session2.id }, () => resolve());
    });

    const receivedMessages: Array<Record<string, unknown>> = [];
    client2.on('new_message', (msg: Record<string, unknown>) => {
      receivedMessages.push(msg);
    });

    await new Promise<void>((resolve) => {
      client1.emit('send_message', { sessionId: session1.id, content: 'Hello room A' }, () => resolve());
    });

    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(receivedMessages.length).toBe(0);

    client1.disconnect();
    client2.disconnect();
  });
});
