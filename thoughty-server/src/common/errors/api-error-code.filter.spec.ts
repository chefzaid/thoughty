import {
  Body,
  Controller,
  Get,
  HttpException,
  INestApplication,
  NotFoundException,
  Post,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { apiError } from './api-error';
import { ApiErrorCodeFilter, genericApiErrorCode } from './api-error-code.filter';

class NoteDto {
  @IsString()
  text!: string;
}

@Controller('errors')
class ErrorsController {
  @Get('coded')
  coded(): never {
    throw apiError(UnauthorizedException, 'AUTH_INVALID_2FA_CODE');
  }

  @Get('plain')
  plain(): never {
    throw new NotFoundException('Entry not found');
  }

  @Get('text')
  text(): never {
    throw new HttpException('Too many requests', 429);
  }

  @Get('teapot')
  teapot(): never {
    throw new HttpException({ message: 'Short and stout' }, 418);
  }

  @Post('notes')
  note(@Body() body: NoteDto): NoteDto {
    return body;
  }

}

describe('ApiErrorCodeFilter', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ErrorsController],
      providers: [{ provide: APP_FILTER, useClass: ApiErrorCodeFilter }],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    await app.init();
  });

  afterAll(async () => app.close());

  it('keeps the code an error was raised with', async () => {
    const response = await request(app.getHttpServer()).get('/errors/coded').expect(401);

    expect(response.body).toEqual({
      statusCode: 401,
      message: 'Invalid or expired verification code.',
      error: 'Unauthorized',
      code: 'AUTH_INVALID_2FA_CODE',
    });
  });

  it('gives an error raised without a code the one for its status, keeping its message', async () => {
    const response = await request(app.getHttpServer()).get('/errors/plain').expect(404);

    expect(response.body).toEqual({ statusCode: 404, message: 'Entry not found', error: 'Not Found', code: 'NOT_FOUND' });
  });

  it('turns a plain-text error body into the usual shape', async () => {
    const response = await request(app.getHttpServer()).get('/errors/text').expect(429);

    expect(response.body).toEqual({ statusCode: 429, message: 'Too many requests', code: 'RATE_LIMITED' });
  });

  it('gives validation errors a generic code and keeps their list of messages', async () => {
    const response = await request(app.getHttpServer()).post('/errors/notes').send({ text: 3 }).expect(400);

    expect(response.body).toEqual({
      statusCode: 400,
      message: ['text must be a string'],
      error: 'Bad Request',
      code: 'VALIDATION_FAILED',
    });
  });

  it('falls back to a generic code by status class', async () => {
    const response = await request(app.getHttpServer()).get('/errors/teapot').expect(418);

    expect(response.body).toEqual({ message: 'Short and stout', code: 'VALIDATION_FAILED' });
    expect(genericApiErrorCode(504)).toBe('INTERNAL_ERROR');
    expect(genericApiErrorCode(503)).toBe('SERVICE_UNAVAILABLE');
  });
});
