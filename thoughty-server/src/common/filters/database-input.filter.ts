import { ArgumentsHost, BadRequestException, Catch } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { QueryFailedError } from 'typeorm';

/** PostgreSQL SQLSTATE for a number outside its column type, e.g. an id above 2^31 - 1. */
const NUMERIC_VALUE_OUT_OF_RANGE = '22003';

/**
 * Turns database errors caused by client input into 400 responses instead of 500s,
 * and lets every other error through to Nest's default handling.
 */
@Catch(QueryFailedError)
export class DatabaseInputExceptionFilter extends BaseExceptionFilter {
  catch(exception: QueryFailedError, host: ArgumentsHost): void {
    const code = (exception.driverError as { code?: string } | undefined)?.code;
    if (code === NUMERIC_VALUE_OUT_OF_RANGE) {
      super.catch(new BadRequestException('Numeric value out of range'), host);
      return;
    }
    super.catch(exception, host);
  }
}
