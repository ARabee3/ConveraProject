import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { Server } from 'http';

describe('Accommodation Domain (e2e)', () => {
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

  describe('GET /properties', () => {
    it('should return an array of active properties', () => {
      return request(httpServer)
        .get('/properties')
        .expect(200)
        .expect((res: request.Response) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should accept price filter query params', () => {
      return request(httpServer).get('/properties?priceMin=50&priceMax=200').expect(200);
    });
  });

  describe('GET /properties/:id', () => {
    it('should return 404 for a non-existent property', () => {
      return request(httpServer).get('/properties/non-existent-id').expect(404);
    });
  });

  describe('POST /host/properties (requires Host JWT)', () => {
    it('should return 401 when no token is provided', () => {
      return request(httpServer)
        .post('/host/properties')
        .send({
          title: 'Test Property',
          description: 'A lovely place',
          type: 'APARTMENT',
          latitude: 30.0444,
          longitude: 31.2357,
          address: 'Cairo, Egypt',
          amenities: ['WiFi'],
          imageUrls: [],
          basePrice: 100,
        })
        .expect(401);
    });
  });

  describe('POST /properties/:propertyId/reviews (requires Customer JWT)', () => {
    it('should return 401 when no token is provided', () => {
      return request(httpServer)
        .post('/properties/some-property-id/reviews')
        .send({ bookingId: '00000000-0000-0000-0000-000000000001', rating: 5 })
        .expect(401);
    });
  });
});
