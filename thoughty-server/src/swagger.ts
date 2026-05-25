import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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
    .addServer(`http://localhost:${process.env.PORT || 3001}`)
    .build();
}

export function createSwaggerDocument(app: INestApplication) {
  return SwaggerModule.createDocument(app, createSwaggerConfig());
}