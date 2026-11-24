import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { apiError } from '@/common/errors';
import { isPlaceholderEmail } from '@/common/utils/placeholder-email.util';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'node:crypto';
import { MoreThan, Repository } from 'typeorm';
import { Setting, User } from '@/database/entities';
import { EmailService } from './email.service';
import { uniqueViolationOf } from './free-username';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Setting)
    private readonly settingRepository: Repository<Setting>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Emails a new verification link, to the address waiting to replace a placeholder when there is one.
   * Registration sends one whatever happens and only logs a failure; a writer who asks for it again
   * (`requireDelivery`) is told when no mail server is configured instead of being told it was sent. An
   * account with only a placeholder has nothing to verify: it is asked for an address first.
   */
  async sendVerificationEmail(
    userId: number,
    { requireDelivery = false }: { requireDelivery?: boolean } = {},
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.findUser(userId);

    if (user.emailVerified && !user.pendingEmail) {
      return { success: true, message: 'Email already verified' };
    }

    const address = user.pendingEmail ?? user.email;
    if (isPlaceholderEmail(address)) {
      throw apiError(BadRequestException, 'AUTH_EMAIL_MISSING');
    }

    if (requireDelivery && !this.emailService.isConfigured()) {
      throw apiError(ServiceUnavailableException, 'EMAIL_DELIVERY_NOT_CONFIGURED');
    }

    await this.sendLink(user, address);
    return { success: true, message: 'Verification email sent' };
  }

  /**
   * Replaces an account's placeholder (it had no address) with the writer's own. Where email can be
   * sent, the address waits in `pendingEmail` until the writer opens the link sent to it, so no one can
   * take an address they cannot read; giving another one replaces it. Without a mail server nothing can
   * be proven: outside production the address is set at once, unverified, as registration does then; in
   * production the answer is 503. An address another account has is refused.
   */
  async addEmail(userId: number, address: string): Promise<void> {
    const user = await this.findUser(userId);
    if (!isPlaceholderEmail(user.email)) {
      throw apiError(ConflictException, 'AUTH_EMAIL_ALREADY_SET');
    }
    const email = address.trim().toLowerCase();
    if (await this.userRepository.exists({ where: { email } })) {
      throw apiError(ConflictException, 'AUTH_EMAIL_TAKEN');
    }

    if (this.emailService.isConfigured()) {
      user.pendingEmail = email;
      await this.sendLink(user, email);
      return;
    }
    if (process.env.NODE_ENV === 'production') {
      throw apiError(ServiceUnavailableException, 'EMAIL_DELIVERY_NOT_CONFIGURED');
    }
    await this.saveAddress(Object.assign(user, { email, pendingEmail: null }));
  }

  /** Marks the address verified; a link sent to an address waiting to replace a placeholder sets it first. */
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({
      where: {
        emailVerificationToken: hashToken(token),
        emailVerificationTokenExpires: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw apiError(BadRequestException, 'AUTH_INVALID_VERIFICATION_TOKEN');
    }

    await this.saveAddress(
      Object.assign(user, {
        email: user.pendingEmail ?? user.email,
        pendingEmail: null,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationTokenExpires: null,
      }),
    );

    return { success: true, message: 'Email verified successfully' };
  }

  private async findUser(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw apiError(NotFoundException, 'USER_NOT_FOUND');
    }
    return user;
  }

  /** Saves the account; an address another account took meanwhile is refused as taken. */
  private async saveAddress(user: User): Promise<void> {
    try {
      await this.userRepository.save(user);
    } catch (error) {
      if (uniqueViolationOf(error) === undefined) throw error;
      throw apiError(ConflictException, 'AUTH_EMAIL_TAKEN');
    }
  }

  /**
   * Stores a new link token (with any change made to `user`) and emails the link in the account's language;
   * a failure is only logged.
   */
  private async sendLink(user: User, address: string): Promise<void> {
    const token = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = hashToken(token);
    user.emailVerificationTokenExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    await this.userRepository.save(user);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

    try {
      const language = await this.settingRepository.findOne({
        where: { userId: user.id, key: 'language' },
        select: { value: true },
      });
      await this.emailService.sendEmailVerificationEmail(address, verificationUrl, language?.value);
    } catch (error) {
      this.logger.warn('Email verification email not sent', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown email provider error',
        userId: user.id,
      });
    }
  }
}
