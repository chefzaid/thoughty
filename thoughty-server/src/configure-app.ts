import { SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import compression from 'compression';
import { createSwaggerDocument } from './swagger';
import { createGlobalValidationPipe } from './common/validation';
import {
  attachCspNonce,
  buildHelmetOptions,
  getRequestPayloadLimits,
  RequestPayloadLimits,
  useImportBodyParser,
  useTrustProxy,
} from './common';

export interface ConfiguredApp {
  payloadLimits: RequestPayloadLimits;
  trustProxy: ReturnType<typeof useTrustProxy>;
}

/**
 * Everything the API puts around its modules: proxy trust, security headers, body parsers,
 * compression, CORS, the `/api` prefix, the global validation pipe and the Swagger UI. `main.ts`
 * and the real-API contract specs (`test/api-contract`) both call it, so the specs run the API
 * exactly as it is deployed. The app must be created with `bodyParser: false`.
 */
export function configureApp(app: NestExpressApplication): ConfiguredApp {
  const payloadLimits = getRequestPayloadLimits();

  // Resolve req.ip to the client behind the ingress; the throttler keys on it.
  const trustProxy = useTrustProxy(app);

  // Security middleware
  app.use(attachCspNonce);
  app.use(helmet(buildHelmetOptions(process.env.NODE_ENV === 'production')));
  useImportBodyParser(app, payloadLimits.importJson);
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
  app.useGlobalPipes(createGlobalValidationPipe());

  // Swagger documentation
  const document = createSwaggerDocument(app);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  return { payloadLimits, trustProxy };
}
