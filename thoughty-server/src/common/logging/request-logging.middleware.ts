import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { FeatureTelemetryService, HttpMetricsService } from '../metrics';
import { JsonLogger } from './json-logger.service';

type RequestWithUser = Request & {
  requestId?: string;
  user?: {
    userId?: number;
  };
};

function getRequestId(headerValue: Request['headers'][string]): string {
  if (Array.isArray(headerValue)) {
    return headerValue[0] || randomUUID();
  }

  return headerValue || randomUUID();
}

function getRoutePath(req: Request): string {
  const rawPath = req.originalUrl || req.url || req.path;
  return rawPath.split('?')[0] || '/';
}

@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: JsonLogger,
    private readonly httpMetrics: HttpMetricsService,
    private readonly featureTelemetry: FeatureTelemetryService,
  ) {}

  use(req: RequestWithUser, res: Response, next: NextFunction): void {
    const requestId = getRequestId(req.headers['x-request-id']);
    const startedAt = process.hrtime.bigint();

    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const latencyMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const metadata = {
        requestId,
        method: req.method,
        path: getRoutePath(req),
        statusCode: res.statusCode,
        latencyMs: Math.round(latencyMs * 100) / 100,
        userId: req.user?.userId,
      };

      this.httpMetrics.record({
        method: metadata.method,
        path: metadata.path,
        statusCode: metadata.statusCode,
        latencyMs: metadata.latencyMs,
      });
      this.featureTelemetry.record({
        method: metadata.method,
        path: metadata.path,
        statusCode: metadata.statusCode,
      });

      if (res.statusCode >= 500) {
        this.logger.error('HTTP request completed', metadata, RequestLoggingMiddleware.name);
        return;
      }

      if (res.statusCode >= 400) {
        this.logger.warn('HTTP request completed', metadata, RequestLoggingMiddleware.name);
        return;
      }

      this.logger.log('HTTP request completed', metadata, RequestLoggingMiddleware.name);
    });

    next();
  }
}
