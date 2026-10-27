import { Body, Controller, Get, Post } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { Public } from './common/decorators/public.decorator';
import { configureApp } from './configure-app';

class NoteDto {
  @IsString()
  text!: string;
}

@Controller('notes')
class NotesController {
  @Public()
  @Get()
  list(): { notes: string[] } {
    return { notes: [] };
  }

  @Post()
  create(@Body() note: NoteDto): NoteDto {
    return note;
  }
}

describe('configureApp', () => {
  let app: NestExpressApplication;
  let configured: ReturnType<typeof configureApp>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [NotesController] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      bodyParser: false,
      logger: false,
    });
    configured = configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the routes under /api with the security headers and CORS for the web app', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/notes')
      .set('Origin', 'http://localhost:5173')
      .expect(200);

    expect(response.body).toEqual({ notes: [] });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    await request(app.getHttpServer()).get('/notes').expect(404);
  });

  it('reads JSON bodies through the global validation pipe, which converts nothing', async () => {
    await request(app.getHttpServer())
      .post('/api/notes')
      .send({ text: 'Hello' })
      .expect(201, { text: 'Hello' });
    await request(app.getHttpServer()).post('/api/notes').send({ text: 5 }).expect(400);
    await request(app.getHttpServer())
      .post('/api/notes')
      .send({ text: 'Hi', extra: true })
      .expect(400);
  });

  it('serves the Swagger UI and reports the body limits it applied', async () => {
    await request(app.getHttpServer()).get('/api-docs-json').expect(200);
    expect(configured.payloadLimits).toEqual({
      json: '1mb',
      urlencoded: '256kb',
      importJson: '8mb',
    });
    expect(configured.trustProxy).toBe(false);
  });
});
