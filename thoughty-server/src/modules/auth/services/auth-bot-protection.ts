import { BadRequestException } from '@nestjs/common';

export function assertHumanAuthAttempt(website?: string): void {
  if (website?.trim()) {
    throw new BadRequestException('Invalid auth request');
  }
}
