import { BadGatewayException, BadRequestException, type HttpException, type Logger } from '@nestjs/common';
import { apiError } from '@/common/errors';

/**
 * Which kind of provider request failed: the authorization code exchange, the refresh of an access token, or an API
 * call made with an access token.
 */
export type ProviderRequestKind = 'code_exchange' | 'token_refresh' | 'api_call';

/** Whether a refused response means the user's authorization is gone, by the kind of request it answered. */
function isAuthorizationRefusal(kind: ProviderRequestKind, status: number): boolean {
  // OAuth answers 400 (`invalid_grant`) to a refused code or refresh token, and 401 (`invalid_client`) to this
  // server's own credentials, which no reconnection fixes. An API call answers 401 to a revoked or expired token.
  return kind === 'api_call' ? status === 401 : status === 400;
}

/**
 * The coded error for a provider response that is not ok. A refused authorization code reads as
 * `CLOUD_AUTHORIZATION_REJECTED`, a refused refresh token or access token as `CLOUD_CONNECTION_EXPIRED`, and every
 * other failure as a 502 `CLOUD_PROVIDER_FAILED`.
 *
 * Only the status is logged and the body is discarded unread: a provider's error body can echo the authorization
 * code, a token or file details.
 */
export async function providerFailure(
  logger: Logger,
  providerName: string,
  action: string,
  response: Response,
  kind: ProviderRequestKind = 'api_call',
): Promise<HttpException> {
  logger.error(`${providerName} ${action} failed with status ${response.status}`);
  if (!response.bodyUsed) {
    await response.body?.cancel().catch(() => undefined);
  }

  if (isAuthorizationRefusal(kind, response.status)) {
    return kind === 'code_exchange'
      ? apiError(BadRequestException, 'CLOUD_AUTHORIZATION_REJECTED', `${providerName} did not accept this sign-in. Please connect again.`)
      : apiError(BadRequestException, 'CLOUD_CONNECTION_EXPIRED', `${providerName} connection expired. Please reconnect.`);
  }
  return apiError(BadGatewayException, 'CLOUD_PROVIDER_FAILED', `${providerName} could not complete the request`);
}
