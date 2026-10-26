import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { apiError } from '@/common/errors';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwksKeyStore } from './jwks-key-store';

interface KeycloakTokenClaims {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  preferred_username?: string;
}

interface GoogleIdTokenClaims {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/** The identity in a verified Google ID token. */
export interface GoogleIdentity {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

/** The identity in a verified Keycloak access token. */
export interface KeycloakIdentity {
  subject: string;
  email: string;
  preferredUsername: string;
}

const GOOGLE_ISSUERS: [string, string] = ['accounts.google.com', 'https://accounts.google.com'];
const GOOGLE_JWKS_URI = 'https://www.googleapis.com/oauth2/v3/certs';

/**
 * Verifies the tokens of the external sign-in providers, Google Identity Services and Keycloak
 * SSO, against their published signing keys, and reads the identity only from verified claims.
 */
@Injectable()
export class IdentityVerificationService {
  private readonly logger = new Logger(IdentityVerificationService.name);
  private readonly keycloakIssuer: string;
  private readonly keycloakAudience: string;
  private readonly keycloakKeys: JwksKeyStore;
  private readonly googleKeys = new JwksKeyStore('Google', GOOGLE_JWKS_URI);
  private readonly googleClientId: string;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.keycloakIssuer = this.configService.get<string>(
      'KEYCLOAK_ISSUER',
      'https://keycloak.swirlit.dev/auth/realms/swirlit',
    );
    this.keycloakAudience = this.configService.get<string>('KEYCLOAK_AUDIENCE', 'oauth2-proxy');
    this.keycloakKeys = new JwksKeyStore(
      'Keycloak',
      this.configService.get<string>(
        'KEYCLOAK_JWKS_URI',
        `${this.keycloakIssuer}/protocol/openid-connect/certs`,
      ),
    );
    this.googleClientId = (this.configService.get<string>('GOOGLE_CLIENT_ID') ?? '').trim();
  }

  /**
   * Verifies a Google Identity Services credential (an ID token): its RS256 signature against
   * Google's published keys, issuer, audience (this server's Google client ID), and expiry. The
   * identity is taken only from the verified claims, and only a Google-verified email is accepted.
   */
  async verifyGoogleCredential(credential: string): Promise<GoogleIdentity> {
    if (!this.googleClientId) {
      throw apiError(ServiceUnavailableException, 'AUTH_GOOGLE_NOT_CONFIGURED');
    }

    let claims: GoogleIdTokenClaims;
    try {
      claims = await this.verifyRs256Token<GoogleIdTokenClaims>(credential, this.googleKeys, {
        issuer: GOOGLE_ISSUERS,
        audience: this.googleClientId,
      });
    } catch (error) {
      this.logger.warn(
        `Rejected Google credential: ${error instanceof Error ? error.message : 'verification failed'}`,
      );
      throw apiError(UnauthorizedException, 'AUTH_GOOGLE_INVALID_CREDENTIAL');
    }

    const sub = typeof claims.sub === 'string' ? claims.sub : '';
    const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
    if (!sub || !email || claims.email_verified !== true) {
      throw apiError(UnauthorizedException, 'AUTH_GOOGLE_EMAIL_UNVERIFIED');
    }

    return {
      sub,
      email,
      name: typeof claims.name === 'string' ? claims.name : undefined,
      picture: typeof claims.picture === 'string' ? claims.picture : undefined,
    };
  }

  /**
   * Verifies a Keycloak SSO access token: its RS256 signature against the realm's keys, issuer,
   * audience, and expiry. The identity needs a subject, a verified email, and a username.
   */
  async verifyKeycloakAccessToken(accessToken?: string): Promise<KeycloakIdentity> {
    if (!accessToken) {
      throw apiError(UnauthorizedException, 'AUTH_KEYCLOAK_TOKEN_MISSING');
    }

    if (!this.readKeyId(accessToken)) {
      throw apiError(UnauthorizedException, 'AUTH_KEYCLOAK_TOKEN_INVALID', 'Keycloak access token has no signing key');
    }

    let claims: KeycloakTokenClaims;
    try {
      claims = await this.verifyRs256Token<KeycloakTokenClaims>(accessToken, this.keycloakKeys, {
        issuer: this.keycloakIssuer,
        audience: this.keycloakAudience,
      });
    } catch (error) {
      this.logger.warn(
        `Rejected Keycloak SSO token: ${error instanceof Error ? error.message : 'verification failed'}`,
      );
      throw apiError(UnauthorizedException, 'AUTH_KEYCLOAK_TOKEN_INVALID');
    }

    const subject = typeof claims.sub === 'string' ? claims.sub : '';
    const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : '';
    const preferredUsername =
      typeof claims.preferred_username === 'string' ? claims.preferred_username : '';
    if (!subject || !email || !preferredUsername || claims.email_verified !== true) {
      throw apiError(UnauthorizedException, 'AUTH_KEYCLOAK_IDENTITY_INCOMPLETE');
    }

    return { subject, email, preferredUsername };
  }

  /** Verifies an RS256 JWT signed with a key from `keys`; throws on any failure. */
  private async verifyRs256Token<T extends object>(
    token: string,
    keys: JwksKeyStore,
    options: { issuer: string | [string, ...string[]]; audience: string },
  ): Promise<T> {
    const keyId = this.readKeyId(token);
    if (!keyId) {
      throw new Error('Token has no signing key id');
    }
    const publicKey = await keys.getPublicKeyPem(keyId);
    return this.jwtService.verifyAsync<T>(token, {
      // JwtService prefers its module-level HMAC secret over an invocation-level
      // `publicKey`. Supplying this verification key as `secret` explicitly
      // overrides that default while jsonwebtoken still validates it as an
      // asymmetric public key for RS256.
      secret: publicKey,
      algorithms: ['RS256'],
      issuer: options.issuer,
      audience: options.audience,
    });
  }

  private readKeyId(token: string): string | undefined {
    const decoded = this.jwtService.decode<{ header?: { kid?: unknown } } | null>(token, {
      complete: true,
    });
    const keyId = decoded?.header?.kid;
    return typeof keyId === 'string' && keyId ? keyId : undefined;
  }
}
