import { BadRequestException } from '@nestjs/common';
import { apiError } from '@/common/errors';

export function assertHumanAuthAttempt(website?: string): void {
  if (website?.trim()) {
    throw apiError(BadRequestException, 'AUTH_INVALID_REQUEST');
  }
}
