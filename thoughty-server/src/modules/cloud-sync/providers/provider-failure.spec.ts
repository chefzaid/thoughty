import { BadGatewayException, BadRequestException, Logger } from '@nestjs/common';
import type { ApiErrorCode } from '@/common/errors';
import { apiErrorCodeOf } from '@/common/errors';
import { providerFailure, type ProviderRequestKind } from './provider-failure';

describe('providerFailure', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test');
    jest.spyOn(logger, 'error').mockImplementation();
  });

  it.each<[ProviderRequestKind, number, typeof BadRequestException | typeof BadGatewayException, ApiErrorCode]>([
    ['code_exchange', 400, BadRequestException, 'CLOUD_AUTHORIZATION_REJECTED'],
    ['code_exchange', 401, BadGatewayException, 'CLOUD_PROVIDER_FAILED'],
    ['code_exchange', 500, BadGatewayException, 'CLOUD_PROVIDER_FAILED'],
    ['token_refresh', 400, BadRequestException, 'CLOUD_CONNECTION_EXPIRED'],
    ['token_refresh', 401, BadGatewayException, 'CLOUD_PROVIDER_FAILED'],
    ['token_refresh', 503, BadGatewayException, 'CLOUD_PROVIDER_FAILED'],
    ['api_call', 401, BadRequestException, 'CLOUD_CONNECTION_EXPIRED'],
    ['api_call', 400, BadGatewayException, 'CLOUD_PROVIDER_FAILED'],
    ['api_call', 429, BadGatewayException, 'CLOUD_PROVIDER_FAILED'],
  ])('maps a %s answered %i to %p %s', async (kind, status, Exception, code) => {
    const error = await providerFailure(logger, 'Google Drive', 'request', new Response('details', { status }), kind);

    expect(error).toBeInstanceOf(Exception);
    expect(apiErrorCodeOf(error)).toBe(code);
  });

  it('names the provider in the message and treats a call without a kind as an API call', async () => {
    const error = await providerFailure(logger, 'OneDrive', 'download', new Response(null, { status: 401 }));

    expect(error.message).toBe('OneDrive connection expired. Please reconnect.');
    expect(apiErrorCodeOf(error)).toBe('CLOUD_CONNECTION_EXPIRED');
  });

  it('logs the status but never the body, and discards the body unread', async () => {
    const response = new Response('{"error":"invalid_grant","access_token":"secret-token"}', { status: 400 });

    const error = await providerFailure(logger, 'Dropbox', 'token exchange', response, 'code_exchange');

    expect(logger.error).toHaveBeenCalledWith('Dropbox token exchange failed with status 400');
    expect(JSON.stringify(error.getResponse())).not.toContain('secret-token');
    await expect(response.text()).rejects.toThrow();
  });

  it('accepts a response whose body was already read', async () => {
    const response = new Response('path/conflict', { status: 409 });
    await response.text();

    const error = await providerFailure(logger, 'Dropbox', 'app folder creation', response);

    expect(apiErrorCodeOf(error)).toBe('CLOUD_PROVIDER_FAILED');
  });
});
