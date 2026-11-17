import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { LOCKED_ACCESS, runWithContentAccess, type ContentAccess } from '@/common/content-lock';
import { CONTENT_UNLOCK_HEADER, ContentUnlockService } from './content-unlock.service';

/**
 * Reads the request's `X-Content-Unlock` header before any guard or handler runs, and runs the rest of
 * the request with what it unlocks (`isContentUnlocked`). A missing, malformed, ended or unknown token
 * unlocks nothing; so does a database error, which then leaves locked content out instead of failing.
 */
@Injectable()
export class ContentUnlockMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ContentUnlockMiddleware.name);

  constructor(private readonly unlocks: ContentUnlockService) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const header = req.headers[CONTENT_UNLOCK_HEADER];
    let access: ContentAccess = LOCKED_ACCESS;
    if (typeof header === 'string' && header) {
      try {
        access = await this.unlocks.resolve(header);
      } catch (error) {
        this.logger.warn(`Unlock not read: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    runWithContentAccess(access, () => next());
  }
}
