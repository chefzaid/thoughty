import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { enrichOpenApiExamples } from './swagger.examples';
import { attachErrorResponseSchema } from './swagger.errors';
import { ApiErrorResponse } from './common/errors/api-error-response.dto';
import { REFRESH_TOKEN_COOKIE } from './modules/auth/refresh-token-cookie';

export function createSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Thoughty Journal API')
    .setDescription('API for Managing Journal Entries')
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT access token',
      },
      'bearerAuth',
    )
    .addCookieAuth(
      REFRESH_TOKEN_COOKIE,
      {
        type: 'apiKey',
        in: 'cookie',
        description: 'httpOnly refresh token cookie (path /api/auth) set when a session starts',
      },
      REFRESH_TOKEN_COOKIE,
    )
    .addServer(`http://localhost:${process.env.PORT || 3001}`)
    .build();
}

export function createSwaggerDocument(app: INestApplication) {
  const document = SwaggerModule.createDocument(app, createSwaggerConfig(), { extraModels: [ApiErrorResponse] });
  return enrichOpenApiExamples(attachErrorResponseSchema(document));
}
