import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { createSwaggerDocument } from '../src/swagger';

async function exportOpenApi() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });

  app.setGlobalPrefix('api');

  const document = createSwaggerDocument(app);
  const outputDir = join(process.cwd(), 'openapi');
  const outputPath = join(outputDir, 'openapi.json');

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputPath, JSON.stringify(document, null, 2));

  await app.close();

  console.log(`OpenAPI schema written to ${outputPath}`);
}

void exportOpenApi();