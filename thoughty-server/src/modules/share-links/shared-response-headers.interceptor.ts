import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';

/**
 * Headers on every answer to a private share link, errors included: never cached (so a revoked link
 * stops at once), never indexed, no referrer sent on from it, and its files not embeddable by other sites.
 */
export const SHARED_RESPONSE_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

@Injectable()
export class SharedResponseHeadersInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const response = context.switchToHttp().getResponse<Response>();
    for (const [name, value] of Object.entries(SHARED_RESPONSE_HEADERS)) {
      response.setHeader(name, value);
    }
    return next.handle();
  }
}
