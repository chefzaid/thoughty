import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';
import { DatabaseInputExceptionFilter } from './database-input.filter';

describe('DatabaseInputExceptionFilter', () => {
  const host = {} as ArgumentsHost;
  let baseCatch: jest.SpyInstance;

  beforeEach(() => {
    baseCatch = jest.spyOn(BaseExceptionFilter.prototype, 'catch').mockImplementation(() => undefined);
  });

  afterEach(() => baseCatch.mockRestore());

  const queryError = (code?: string) =>
    new QueryFailedError('SELECT 1', [], Object.assign(new Error('db'), { code }));

  it('reports out-of-range numeric input as a bad request', () => {
    new DatabaseInputExceptionFilter().catch(queryError('22003'), host);

    const [error] = baseCatch.mock.calls[0];
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).message).toBe('Numeric value out of range');
  });

  it('passes other database errors through unchanged', () => {
    const error = queryError('23505');
    new DatabaseInputExceptionFilter().catch(error, host);

    expect(baseCatch).toHaveBeenCalledWith(error, host);
  });
});
