import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Auth', () => {
    it('/api/auth/register (POST) - should require email and password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({})
        .expect(400);
    });

    it('/api/auth/login (POST) - should reject invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ identifier: 'nonexistent@example.com', password: 'wrongpassword' })
        .expect(401);
    });
  });

  describe('Protected Routes', () => {
    it('/api/entries (GET) - should require authentication', () => {
      return request(app.getHttpServer()).get('/api/entries').expect(401);
    });

    it('/api/diaries (GET) - should require authentication', () => {
      return request(app.getHttpServer()).get('/api/diaries').expect(401);
    });

    it('/api/stats (GET) - should require authentication', () => {
      return request(app.getHttpServer()).get('/api/stats').expect(401);
    });

    it('/api/config (GET) - should require authentication', () => {
      return request(app.getHttpServer()).get('/api/config').expect(401);
    });
  });
});
