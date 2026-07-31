import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('API endpoint usage', () => {
  it('keeps every product API operation connected to frontend code', () => {
    const output = execFileSync(process.execPath, ['scripts/check-api-usage.mjs'], {
      cwd: resolve(import.meta.dirname, '..'),
      encoding: 'utf8',
    });

    expect(output).toContain('API usage audit passed');
  });
});
