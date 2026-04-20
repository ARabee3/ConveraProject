import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('Events Domain (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /events', () => {
    it('should return an array of events', () => {
      return request(app.getHttpServer())
        .get('/events')
        .expect(200)
        .expect((res: request.Response) => {
          expect(Array.isArray(res.body.events)).toBe(true);
        });
    });

    it('should accept cursor and limit query params', () => {
      return request(app.getHttpServer()).get('/events?cursor=1&limit=10').expect(200);
    });

    it('should accept location filter query params', () => {
      return request(app.getHttpServer())
        .get('/events?lat=30.0444&lng=31.2357&radius=50')
        .expect(200);
    });

    it('should accept date filter query params', () => {
      return request(app.getHttpServer()).get('/events?date=2026-05-01').expect(200);
    });

    it('should accept category filter query params', () => {
      return request(app.getHttpServer())
        .get('/events?categoryId=00000000-0000-4000-8000-000000000000')
        .expect(200);
    });

    it('should accept price range filter query params', () => {
      return request(app.getHttpServer()).get('/events?priceMin=50&priceMax=200').expect(200);
    });

    it('should accept minAge filter query params', () => {
      return request(app.getHttpServer()).get('/events?minAge=18').expect(200);
    });

    it('should accept ticketTypes filter query params', () => {
      return request(app.getHttpServer())
        .get('/events?ticketTypes=General&ticketTypes=VIP')
        .expect(200);
    });
  });

  describe('GET /events/:id', () => {
    it('should return 404 for a non-existent event', () => {
      return request(app.getHttpServer())
        .get('/events/00000000-0000-4000-8000-000000000000')
        .expect(404);
    });
  });
});
