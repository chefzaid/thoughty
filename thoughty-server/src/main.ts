import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { createSwaggerDocument } from './swagger';
import { attachCspNonce, buildHelmetOptions } from './common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn'],
  });

  // Security middleware
  app.use(attachCspNonce);
  app.use(helmet(buildHelmetOptions(process.env.NODE_ENV === 'production')));

  // Compression
  app.use(compression());

  // CORS
  const corsOrigins = process.env.CORS_ORIGIN?.split(',') || [
    'http://localhost:5173',
    'http://localhost:3000',
  ];
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400, // 24 hours
  });

  // Global prefix for all routes
  app.setGlobalPrefix('api');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger documentation
  const document = createSwaggerDocument(app);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📚 API Documentation available at http://localhost:${port}/api-docs`);
}

void bootstrap();
