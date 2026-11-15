import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { apiError } from '@/common/errors';
import { sanitizeString } from '@/common/utils';
import { RefreshToken, Setting, SignUpRequest, User } from '@/database/entities';
import { saveNewAccount } from './default-diary';
import { freeUsername, takenConflict, uniqueViolationOf, USERNAME_MAX_LENGTH } from './free-username';

export type SignInProvider = 'google' | 'keycloak';

/**
 * An identity a provider verified: its subject (stable for the provider), its address, which the
 * provider asserts is verified (`IdentityVerificationService` refuses any other), in lower case,
 * and the name and picture it suggests for a new account.
 */
export interface ProviderIdentity {
  provider: SignInProvider;
  subject: string;
  email: string;
  suggestedUsername?: string;
  avatarUrl?: string;
}

export interface ProviderAccount {
  user: User;
  isNewUser: boolean;
}

/** Tries at signing in when a racing request takes the new account's username or address. */
const SIGN_IN_ATTEMPTS = 3;

/**
 * Everything someone who registered an address without proving it may have set up to keep using
 * the account: its password, a two-factor setting and a pending challenge, and pending
 * verification and reset links. Cleared when a provider proves the address belongs to someone.
 */
const UNPROVEN_ACCESS_CLEARED: Partial<User> = {
  passwordHash: null,
  twoFactorEnabled: false,
  twoFactorChallengeTokenHash: null,
  twoFactorChallengeCodeHash: null,
  twoFactorChallengePurpose: null,
  twoFactorChallengeExpires: null,
  emailVerificationToken: null,
  emailVerificationTokenExpires: null,
  resetToken: null,
  resetTokenExpires: null,
};

/**
 * The account behind a Google or Keycloak sign-in: the one linked to the provider's subject, else
 * the one with the provider-verified address (linked to the subject from then on), else a new one.
 *
 * Linking an account whose address was never verified takes it over for the provider's user, who
 * has just proven the address: whoever registered it may have been someone else (a pre-account
 * takeover), so its password, two-factor setting, pending links, sessions and cloud backup
 * connections are dropped in the same transaction. Its diaries and entries stay.
 */
@Injectable()
export class ProviderAccountService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async signIn(identity: ProviderIdentity): Promise<ProviderAccount> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.findLinkOrCreate(identity);
      } catch (error) {
        // Another request took the username, or created the account for this address: look again
        const constraint = uniqueViolationOf(error);
        if (constraint === undefined) throw error;
        if (attempt >= SIGN_IN_ATTEMPTS) throw takenConflict(constraint);
      }
    }
  }

  private async findLinkOrCreate(identity: ProviderIdentity): Promise<ProviderAccount> {
    const linked = await this.userRepository.findOne({
      where: { authProvider: identity.provider, providerId: identity.subject },
    });
    const user = linked ?? (await this.userRepository.findOne({ where: { email: identity.email } }));
    if (user?.deletedAt) {
      throw apiError(ForbiddenException, 'AUTH_ACCOUNT_DELETED');
    }
    if (!user) {
      return { user: await this.create(identity), isNewUser: true };
    }
    if (linked && user.emailVerified) {
      return { user, isNewUser: false };
    }
    return {
      user: user.emailVerified ? await this.link(user, identity) : await this.claim(user, identity),
      isNewUser: false,
    };
  }

  private linkFields(user: User, identity: ProviderIdentity): Partial<User> {
    return {
      authProvider: identity.provider,
      providerId: identity.subject,
      avatarUrl: identity.avatarUrl || user.avatarUrl,
      emailVerified: true,
    };
  }

  /** Links a verified account: its owner already proved the address, so nothing else changes. */
  private async link(user: User, identity: ProviderIdentity): Promise<User> {
    return this.userRepository.save(Object.assign(user, this.linkFields(user, identity)));
  }

  /** Links an unverified account and drops every way in that its registrant set up. */
  private async claim(user: User, identity: ProviderIdentity): Promise<User> {
    return this.dataSource.transaction(async (manager) => {
      const claimed = await manager.save(
        User,
        Object.assign(user, this.linkFields(user, identity), UNPROVEN_ACCESS_CLEARED),
      );
      await manager.delete(RefreshToken, { userId: user.id });
      await manager.delete(SignUpRequest, { email: user.email });
      // A cloud drive connected by the registrant would keep receiving the owner's backups
      await manager
        .createQueryBuilder()
        .delete()
        .from(Setting)
        .where('user_id = :userId', { userId: user.id })
        .andWhere('key LIKE :prefix', { prefix: 'cloud\\_%' })
        .execute();
      return claimed;
    });
  }

  /** A verified account with the default diary, named as the provider suggests when that is free. */
  private async create(identity: ProviderIdentity): Promise<User> {
    const suggested = sanitizeString((identity.suggestedUsername ?? '').trim());
    const base = suggested.substring(0, USERNAME_MAX_LENGTH) || identity.email.split('@')[0];
    const username = await freeUsername(this.userRepository, base);
    return this.dataSource.transaction((manager) =>
      saveNewAccount(manager, {
        username,
        email: identity.email,
        authProvider: identity.provider,
        providerId: identity.subject,
        avatarUrl: identity.avatarUrl ?? null,
        emailVerified: true,
      }),
    );
  }
}
