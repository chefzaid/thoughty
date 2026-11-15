import {
  Body,
  CanActivate,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { Public } from './common/decorators/public.decorator';
import { configureApp } from './configure-app';
import { SHARED_RESPONSE_HEADERS } from './modules/share-links/shared-response-headers.middleware';

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

class RateLimitedGuard implements CanActivate {
  canActivate(): boolean {
    throw new HttpException('Too many requests', HttpStatus.TOO_MANY_REQUESTS);
  }
}

/** Routes under `/api/shared`, answered by a guard, a pipe, an uncaught error and the handler. */
@Public()
@Controller('shared')
class SharedController {
  @Get('limited')
  @UseGuards(RateLimitedGuard)
  limited(): void {}

  @Get('broken')
  broken(): never {
    throw new Error('Unexpected');
  }

  @Get(':id')
  read(@Param('id', ParseIntPipe) id: number): { id: number } {
    return { id };
  }
}

const sharedHeadersOf = (headers: Record<string, string>) => ({
  'cache-control': headers['cache-control'],
  'x-robots-tag': headers['x-robots-tag'],
  'referrer-policy': headers['referrer-policy'],
  'cross-origin-resource-policy': headers['cross-origin-resource-policy'],
});
const SHARED_HEADERS = Object.fromEntries(
  Object.entries(SHARED_RESPONSE_HEADERS).map(([name, value]) => [name.toLowerCase(), value]),
);

describe('configureApp', () => {
  let app: NestExpressApplication;
  let configured: ReturnType<typeof configureApp>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [NotesController, SharedController] }).compile();
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

  it('gives every answer under /api/shared the private link headers, whatever produced it', async () => {
    const server = app.getHttpServer();
    const preflight = () =>
      request(server)
        .options('/api/shared/7')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET');
    const answers = [
      await request(server).get('/api/shared/7').expect(200, { id: 7 }),
      await request(server).get('/api/shared/limited').expect(429),
      await request(server).get('/api/shared/seven').expect(400),
      await request(server).get('/api/shared/broken').expect(500),
      await request(server).get('/api/shared/7/no/such/path').expect(404),
      await request(server).get('/api/shared').expect(404),
      await request(server).get('/API/Shared/7').expect(200),
      await preflight().expect(204),
    ];
    for (const answer of answers) {
      expect(sharedHeadersOf(answer.headers)).toEqual(SHARED_HEADERS);
    }
  });

  it('leaves the other routes to helmet’s headers', async () => {
    const server = app.getHttpServer();
    for (const path of ['/api/notes', '/api/sharedness']) {
      const response = await request(server).get(path);
      expect(response.headers['cache-control']).toBeUndefined();
      expect(response.headers['x-robots-tag']).toBeUndefined();
      expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
    }
  });
});
