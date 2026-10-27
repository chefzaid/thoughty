import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { JsonLogger } from './common';

async function bootstrap() {
  const logger = new JsonLogger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger,
  });
  const { payloadLimits, trustProxy } = configureApp(app);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  logger.log('Server started', {
    port,
    apiUrl: `http://localhost:${port}`,
    docsUrl: `http://localhost:${port}/api-docs`,
    jsonBodyLimit: payloadLimits.json,
    formBodyLimit: payloadLimits.urlencoded,
    importBodyLimit: payloadLimits.importJson,
    trustProxy,
  });
}

void bootstrap();
