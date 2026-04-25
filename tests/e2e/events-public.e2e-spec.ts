import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { Server } from 'http';

describe('Events Domain (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    httpServer = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /events', () => {
    it('should return an array of events', () => {
      return request(httpServer)
        .get('/events')
        .expect(200)
        .expect((res: request.Response) => {
          const body = res.body as { events: unknown[] };
          expect(Array.isArray(body.events)).toBe(true);
        });
    });

    it('should accept cursor and limit query params', () => {
      return request(httpServer).get('/events?cursor=1&limit=10').expect(200);
    });

    it('should accept location filter query params', () => {
      return request(httpServer).get('/events?lat=30.0444&lng=31.2357&radius=50').expect(200);
    });

    it('should accept date filter query params', () => {
      return request(httpServer).get('/events?date=2026-05-01').expect(200);
    });

    it('should accept category filter query params', () => {
      return request(httpServer)
        .get('/events?categoryId=00000000-0000-4000-8000-000000000000')
        .expect(200);
    });

    it('should accept price range filter query params', () => {
      return request(httpServer).get('/events?priceMin=50&priceMax=200').expect(200);
    });

    it('should accept minAge filter query params', () => {
      return request(httpServer).get('/events?minAge=18').expect(200);
    });

    it('should accept ticketTypes filter query params', () => {
      return request(httpServer).get('/events?ticketTypes=General&ticketTypes=VIP').expect(200);
    });
  });

  describe('GET /events/:id', () => {
    it('should return 404 for a non-existent event', () => {
      return request(httpServer).get('/events/00000000-0000-4000-8000-000000000000').expect(404);
    });
  });
});
