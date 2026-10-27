import { Injectable, Logger, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { unlink } from 'node:fs/promises';
import type { Request } from 'express';
import { finalize, type Observable } from 'rxjs';

/**
 * Deletes the temporary file a disk upload wrote, once the request is answered, whether the handler
 * stored it, refused it, or never ran (a validation error). Multer itself removes a partial file it
 * stopped at the size limit.
 */
@Injectable()
export class TempUploadCleanupInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TempUploadCleanupInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    return next.handle().pipe(
      finalize(() => {
        const path = request.file?.path;
        if (path) {
          unlink(path).catch((error: Error) => this.logger.warn(`Could not delete upload ${path}: ${error.message}`));
        }
      }),
    );
  }
}
