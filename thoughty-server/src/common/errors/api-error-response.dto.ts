import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { API_ERROR_CODES, type ApiErrorCode } from './api-error-codes';

/** The OpenAPI schema of an error body (`ApiErrorBody`). */
export class ApiErrorResponse {
  @ApiProperty({ example: 401 })
  statusCode!: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    description: 'English text, or a list of them for validation errors. Clients translate by `code`.',
    example: 'Invalid or expired verification code.',
  })
  message!: string | string[];

  @ApiProperty({ example: 'Unauthorized', description: 'The HTTP reason phrase' })
  error!: string;

  @ApiPropertyOptional({
    enum: API_ERROR_CODES,
    enumName: 'ApiErrorCode',
    example: 'AUTH_INVALID_2FA_CODE',
    description: 'Stable machine-readable code (docs/architecture.md, "API error codes"). Every error the API raises carries one; only an unexpected server failure (500) may come without it.',
  })
  code?: ApiErrorCode;
}
