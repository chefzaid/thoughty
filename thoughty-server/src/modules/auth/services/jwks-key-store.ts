import * as crypto from 'node:crypto';

export interface SigningJwk extends crypto.JsonWebKey {
  kid?: string;
  use?: string;
}

const JWKS_CACHE_TTL_MS = 5 * 60 * 1_000;

/**
 * Fetches and caches an identity provider's JSON Web Key Set. An unknown key id triggers one
 * refetch, so a provider's key rotation is picked up before the cache expires.
 */
export class JwksKeyStore {
  private cache: { expiresAt: number; keys: SigningJwk[] } | null = null;

  constructor(
    private readonly label: string,
    private readonly jwksUri: string,
  ) {}

  /** The PEM public key for `keyId`, ready for RS256 verification. */
  async getPublicKeyPem(keyId: string): Promise<string> {
    const signingKey = await this.getSigningKey(keyId);
    return crypto
      .createPublicKey({ key: signingKey, format: 'jwk' })
      .export({ type: 'spki', format: 'pem' })
      .toString();
  }

  async getSigningKey(keyId: string): Promise<SigningJwk> {
    if (!this.cache || this.cache.expiresAt <= Date.now()) {
      await this.refresh();
    }
    let signingKey = this.findKey(keyId);
    if (!signingKey) {
      await this.refresh();
      signingKey = this.findKey(keyId);
    }
    if (!signingKey) {
      throw new Error(`${this.label} signing key is unavailable`);
    }
    return signingKey;
  }

  private findKey(keyId: string): SigningJwk | undefined {
    return this.cache?.keys.find(
      (key) => key.kid === keyId && (key.use === undefined || key.use === 'sig'),
    );
  }

  async refresh(): Promise<void> {
    const response = await fetch(this.jwksUri, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) {
      throw new Error(`${this.label} JWKS request failed with ${response.status}`);
    }
    const body = (await response.json()) as { keys?: SigningJwk[] };
    if (!Array.isArray(body.keys) || body.keys.length === 0) {
      throw new Error(`${this.label} JWKS response has no keys`);
    }
    this.cache = {
      keys: body.keys,
      expiresAt: Date.now() + JWKS_CACHE_TTL_MS,
    };
  }
}
