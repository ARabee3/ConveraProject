import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const JWT_SECRET = 'fallback_secret';
process.env.JWT_SECRET = JWT_SECRET;

describe('ChatGateway Auth (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let redis: Redis;
  let httpUrl: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = app.get<PrismaService>(PrismaService);
    const configService = app.get<ConfigService>(ConfigService);

    const redisUrl = configService.get<string>('REDIS_URL');
    redis = new Redis(redisUrl || 'redis://localhost:6379');

    await app.listen(0);
    httpUrl = `http://localhost:${(app.getHttpServer().address() as { port: number }).port}`;
  });

  afterAll(async () => {
    await redis.quit();
    await app.close();
  });

  afterEach(async () => {
    await prismaService.chatMessage.deleteMany();
    await prismaService.chatSession.deleteMany();
    await prismaService.property.deleteMany();
    await prismaService.user.deleteMany();
  });

  it('should reject connection without JWT', (done) => {
    const client = io(`${httpUrl}/chat`, { transports: ['websocket'] });

    client.on('connect_error', (err) => {
      expect(err.message).toBe('Unauthorized: no token provided');
      client.disconnect();
      done();
    });
  });

  it('should reject connection with invalid JWT', (done) => {
    const client = io(`${httpUrl}/chat`, {
      transports: ['websocket'],
      auth: { token: 'invalid-token' },
    });

    client.on('connect_error', (err) => {
      expect(err.message).toBe('Unauthorized: invalid token');
      client.disconnect();
      done();
    });
  });

  it('should accept connection with valid JWT', async () => {
    const user = await prismaService.user.create({
        data: {
            email: `test-${randomUUID()}@example.com`,
            passwordHash: 'hash',
            role: 'CUSTOMER',
            isVerified: true,
        }
    });

    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET);
    const client = io(`${httpUrl}/chat`, {
      transports: ['websocket'],
      auth: { token },
    });

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.disconnect();
        reject(new Error('Timeout waiting for connection'));
      }, 3000);

      client.on('connect', () => {
        clearTimeout(timeout);
        client.disconnect();
        resolve();
      });

      client.on('connect_error', (err) => {
        clearTimeout(timeout);
        client.disconnect();
        reject(err);
      });
    });
  });
});
