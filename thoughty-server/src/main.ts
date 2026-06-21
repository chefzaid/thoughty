import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { createSwaggerDocument } from './swagger';
import { attachCspNonce, buildHelmetOptions, getRequestPayloadLimits, JsonLogger } from './common';

async function bootstrap() {
  const logger = new JsonLogger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger,
  });
  const payloadLimits = getRequestPayloadLimits();

  // Security middleware
  app.use(attachCspNonce);
  app.use(helmet(buildHelmetOptions(process.env.NODE_ENV === 'production')));
  app.useBodyParser('json', { limit: payloadLimits.json });
  app.useBodyParser('urlencoded', { extended: true, limit: payloadLimits.urlencoded });

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

  logger.log('Server started', {
    port,
    apiUrl: `http://localhost:${port}`,
    docsUrl: `http://localhost:${port}/api-docs`,
    jsonBodyLimit: payloadLimits.json,
    formBodyLimit: payloadLimits.urlencoded,
  });
}

void bootstrap();
