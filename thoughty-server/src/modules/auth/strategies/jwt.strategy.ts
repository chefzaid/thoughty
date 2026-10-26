import { Injectable, UnauthorizedException } from '@nestjs/common';
import { apiError } from '@/common/errors';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { getSigningSecret } from '../auth-secrets';

export interface JwtPayload {
  userId: number;
  email: string;
  username: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: getSigningSecret(configService, 'JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (!payload.userId) {
      throw apiError(UnauthorizedException, 'AUTH_INVALID_TOKEN');
    }
    return {
      userId: payload.userId,
      email: payload.email,
      username: payload.username,
    };
  }
}
