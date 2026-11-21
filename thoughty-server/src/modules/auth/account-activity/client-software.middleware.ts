import { Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { parseUserAgent, runWithClientSoftware } from './client-software';

/**
 * Reads the browser and system names from the request's `User-Agent` before any guard or handler runs,
 * so account activity can record them; the header itself is not kept.
 */
@Injectable()
export class ClientSoftwareMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    runWithClientSoftware(parseUserAgent(req.headers['user-agent']), () => next());
  }
}
