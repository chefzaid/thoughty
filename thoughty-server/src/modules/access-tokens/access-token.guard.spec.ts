import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '@/common/decorators';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { AccessTokenGuard, AccessTokenScopes, CurrentAccessToken } from './access-token.guard';

const token = { tokenId: 3, userId: 5, email: 'w@example.com', username: 'writer', scopes: ['entries:write'], timeZone: 'UTC' };

class Routes {
  @AccessTokenScopes('entries:read', 'entries:write')
  either(): void {}

  @AccessTokenScopes('entries:read')
  readOnly(): void {}
}

function contextFor(handler: keyof Routes, authorization?: string) {
  const request: Record<string, unknown> = { headers: authorization === undefined ? {} : { authorization } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => Routes.prototype[handler],
    getClass: () => Routes,
  } as unknown as ExecutionContext;
  return { context, request };
}

describe('AccessTokenGuard', () => {
  const accessTokens = { authenticate: jest.fn() };
  const guard = new AccessTokenGuard(new Reflector(), accessTokens as never);

  beforeEach(() => accessTokens.authenticate.mockReset());

  it('lets a token holding one of the route’s scopes through, acting for its writer', async () => {
    accessTokens.authenticate.mockResolvedValue(token);
    const { context, request } = contextFor('either', 'Bearer thy_secret');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(accessTokens.authenticate).toHaveBeenCalledWith('thy_secret');
    expect(request.user).toEqual({ userId: 5, email: 'w@example.com', username: 'writer' });
    expect(request.accessToken).toBe(token);
  });

  it('refuses a request without a bearer token, or with one that is not valid', async () => {
    await expectApiError(guard.canActivate(contextFor('either').context), UnauthorizedException, 'ACCESS_TOKEN_INVALID');
    await expectApiError(guard.canActivate(contextFor('either', 'Basic abc').context), UnauthorizedException, 'ACCESS_TOKEN_INVALID');
    expect(accessTokens.authenticate).not.toHaveBeenCalled();

    accessTokens.authenticate.mockResolvedValue(null);
    await expectApiError(guard.canActivate(contextFor('either', 'Bearer eyJ.e30.sig').context), UnauthorizedException, 'ACCESS_TOKEN_INVALID');
  });

  it('refuses a token without the route’s scope', async () => {
    accessTokens.authenticate.mockResolvedValue(token);
    const { context, request } = contextFor('readOnly', 'bearer thy_secret');

    await expectApiError(guard.canActivate(context), ForbiddenException, 'ACCESS_TOKEN_SCOPE_MISSING');
    expect(request.user).toBeUndefined();
  });

  it('marks its routes public to the session guard', () => {
    expect(new Reflector().get(IS_PUBLIC_KEY, Routes.prototype.either)).toBe(true);
  });
});

describe('CurrentAccessToken', () => {
  it('reads the token the guard let the request through with', () => {
    class Controller {
      route(@CurrentAccessToken() _token: unknown): void {}
    }
    const [{ factory }] = Object.values(Reflect.getMetadata(ROUTE_ARGS_METADATA, Controller, 'route') as Record<string, { factory: (data: unknown, context: ExecutionContext) => unknown }>);
    const { context, request } = contextFor('either');
    request.accessToken = token;

    expect(factory(undefined, context)).toBe(token);
  });
});
