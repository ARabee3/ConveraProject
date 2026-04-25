import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { Server } from 'http';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let httpServer: Server;
  let redis: Redis;

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
    const configService = app.get<ConfigService>(ConfigService);

    const redisUrl = configService.get<string>('REDIS_URL');
    redis = new Redis(redisUrl || 'redis://localhost:6379');

    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await prismaService.refreshToken.deleteMany();
    await prismaService.user.deleteMany();
    await redis.quit();
    await app.close();
  });

  const testUser = {
    email: 'test-e2e@example.com',
    password: 'Password123!',
  };

  let accessToken: string;
  let refreshToken: string;

  describe('User Story 1 & 3: Registration, Verification, Login & Validation', () => {
    it('should fail with validation error for malformed payload', () => {
      return request(httpServer)
        .post('/auth/register')
        .send({ email: 'bad-email', password: '123' })
        .expect(400)
        .expect((res: request.Response) => {
          const body = res.body as {
            error: string;
            message: string | string[];
            statusCode: number;
          };
          expect(body.error).toBe('Bad Request');
          expect(Array.isArray(body.message)).toBe(true);
          expect(body.statusCode).toBe(400);
        });
    });

    it('should register a new user successfully', async () => {
      const response = await request(httpServer).post('/auth/register').send(testUser).expect(201);

      expect((response.body as { message: string }).message).toContain('registered successfully');
    });

    it('should fail to login if not verified', async () => {
      await request(httpServer)
        .post('/auth/login')
        .send(testUser)
        .expect(401)
        .expect((res: request.Response) => {
          expect((res.body as { message: string }).message).toBe('User email not verified.');
        });
    });

    it('should verify OTP and activate account', async () => {
      // Fetch OTP from Redis
      const key = `otp:verify:${testUser.email}`;
      const dataStr = (await redis.get(key)) as string;
      const { code } = JSON.parse(dataStr) as { code: string };

      await request(httpServer)
        .post('/auth/verify')
        .send({ email: testUser.email, code })
        .expect(200)
        .expect((res: request.Response) => {
          expect((res.body as { message: string }).message).toBe('Email verified successfully.');
        });

      const user = await prismaService.user.findUnique({ where: { email: testUser.email } });
      expect(user?.isVerified).toBe(true);
    });

    it('should login successfully and return tokens', async () => {
      const response = await request(httpServer).post('/auth/login').send(testUser).expect(200);

      const data = (response.body as { data: { accessToken: string; refreshToken: string } }).data;
      expect(data.accessToken).toBeDefined();
      expect(data.refreshToken).toBeDefined();

      accessToken = data.accessToken;
      refreshToken = data.refreshToken;
    });

    it('should refresh tokens using the refresh token', async () => {
      const response = await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      const data = (response.body as { data: { accessToken: string; refreshToken: string } }).data;
      expect(data.accessToken).toBeDefined();
      expect(data.refreshToken).toBeDefined();
      expect(data.accessToken).not.toBe(accessToken);

      accessToken = data.accessToken;
      refreshToken = data.refreshToken;
    });
  });

  describe('User Story 2: Role-Based Access Control', () => {
    it('should allow access to admin content IF user is admin (Mock update)', async () => {
      // Manually elevate role for test
      await prismaService.user.update({
        where: { email: testUser.email },
        data: { role: 'ADMIN' },
      });

      // Relogin to get new token with role
      const loginRes = await request(httpServer).post('/auth/login').send(testUser);
      const adminToken = (loginRes.body as { data: { accessToken: string } }).data.accessToken;

      await request(httpServer)
        .get('/auth/test-rbac')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should reject access if user does not have the required role', async () => {
      // Demote to CUSTOMER
      await prismaService.user.update({
        where: { email: testUser.email },
        data: { role: 'CUSTOMER' },
      });

      const loginRes = await request(httpServer).post('/auth/login').send(testUser);
      const customerToken = (loginRes.body as { data: { accessToken: string } }).data.accessToken;

      await request(httpServer)
        .get('/auth/test-rbac')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe('FR-008: Password Reset Flow', () => {
    it('should request a password reset successfully', async () => {
      const response = await request(httpServer)
        .post('/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect((response.body as { message: string }).message).toContain('reset code has been sent');
    });

    it('should reset password with valid OTP and new password', async () => {
      const key = `otp:reset:${testUser.email}`;
      const dataStr = (await redis.get(key)) as string;
      const { code } = JSON.parse(dataStr) as { code: string };

      const newPassword = 'NewPassword123!';

      await request(httpServer)
        .post('/auth/reset-password')
        .send({ email: testUser.email, code, password: newPassword })
        .expect(200);

      // Verify login with OLD password fails
      await request(httpServer).post('/auth/login').send(testUser).expect(401);

      // Verify login with NEW password succeeds
      await request(httpServer)
        .post('/auth/login')
        .send({ email: testUser.email, password: newPassword })
        .expect(200);
    });
  });
});
