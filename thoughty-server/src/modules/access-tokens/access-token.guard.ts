import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  applyDecorators,
  createParamDecorator,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public, type AuthenticatedUser } from '@/common/decorators';
import { apiError } from '@/common/errors';
import type { AccessTokenScope } from '@/database/entities';
import { AccessTokensService, type AuthenticatedAccessToken } from './access-tokens.service';

const ACCESS_TOKEN_SCOPES_KEY = 'accessTokenScopes';

type AccessTokenRequest = Request & { user?: AuthenticatedUser; accessToken?: AuthenticatedAccessToken };

/** The token from `Authorization: Bearer <token>`, or null without one. */
function bearerToken(request: Request): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '');
  return match ? match[1] : null;
}

/**
 * Lets a public API request through when it sends a valid personal access token holding one of the
 * route's scopes: 401 ACCESS_TOKEN_INVALID without a valid token, 403 ACCESS_TOKEN_SCOPE_MISSING without
 * the scope. The request then acts for the token's writer (`@CurrentUser()`), and never with a session's
 * access token: those are refused here like any other unknown token.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessTokens: AccessTokensService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AccessTokenRequest>();
    const sent = bearerToken(request);
    const token = sent ? await this.accessTokens.authenticate(sent) : null;
    if (!token) {
      throw apiError(UnauthorizedException, 'ACCESS_TOKEN_INVALID');
    }
    const allowed = this.reflector.getAllAndOverride<AccessTokenScope[] | undefined>(ACCESS_TOKEN_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) ?? [];
    if (!allowed.some((scope) => token.scopes.includes(scope))) {
      throw apiError(ForbiddenException, 'ACCESS_TOKEN_SCOPE_MISSING');
    }
    request.user = { userId: token.userId, email: token.email, username: token.username };
    request.accessToken = token;
    return true;
  }
}

/**
 * A public API route, open to a personal access token with any one of `scopes` instead of a session
 * (the global session guard lets it through).
 */
export const AccessTokenScopes = (...scopes: AccessTokenScope[]) =>
  applyDecorators(
    Public(),
    SetMetadata(ACCESS_TOKEN_SCOPES_KEY, scopes),
    UseGuards(AccessTokenGuard),
    ApiBearerAuth('access-token'),
    ApiResponse({ status: 401, description: 'ACCESS_TOKEN_INVALID: no token, or one that is unknown, revoked or expired' }),
    ApiResponse({ status: 403, description: `ACCESS_TOKEN_SCOPE_MISSING: the token holds none of ${scopes.map((scope) => `\`${scope}\``).join(', ')}` }),
  );

/** The personal access token the request was let through with (`AccessTokenGuard`). */
export const CurrentAccessToken = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedAccessToken =>
    context.switchToHttp().getRequest<AccessTokenRequest>().accessToken!,
);
