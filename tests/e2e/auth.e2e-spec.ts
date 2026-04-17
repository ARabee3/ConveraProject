import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';
import { Server } from 'http';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let httpServer: Server;

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
  });

  afterAll(async () => {
    await prismaService.refreshToken.deleteMany();
    await prismaService.user.deleteMany();
    await app.close();
  });

  const testUser = {
    email: 'test@example.com',
    password: 'Password123!',
  };

  it('/auth/register (POST) - success', () => {
    return request(httpServer)
      .post('/auth/register')
      .send(testUser)
      .expect(201)
      .expect((res: request.Response) => {
        expect((res.body as Record<string, unknown>).message).toContain('registered successfully');
      });
  });

  it('/auth/register (POST) - fail (duplicate email)', () => {
    return request(httpServer).post('/auth/register').send(testUser).expect(409);
  });

  it('/auth/login (POST) - fail (unverified)', () => {
    return request(httpServer).post('/auth/login').send(testUser).expect(401);
  });

  it('/auth/test-rbac (GET) - fail (unauthorized without token)', () => {
    return request(httpServer).get('/auth/test-rbac').expect(401);
  });

  it('/auth/register (POST) - fail (validation error)', () => {
    return request(httpServer)
      .post('/auth/register')
      .send({ email: 'not-an-email', password: '123' })
      .expect(400)
      .expect((res: request.Response) => {
        const body = res.body as Record<string, unknown>;
        expect(body.error).toBe('Bad Request');
        expect(Array.isArray(body.message)).toBeTruthy();
      });
  });
});
