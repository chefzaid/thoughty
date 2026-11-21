import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { apiError } from '@/common/errors';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { RefreshToken, User } from '@/database/entities';
import { ChangePasswordDto } from '../dto';
import { EmailService } from './email.service';
import { AccountActivityService } from '../account-activity/account-activity.service';

const FORGOT_PASSWORD_MESSAGE = 'If an account exists with this email, a reset link will be sent.';
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Reset tokens are stored as the SHA-256 hex of the token; the token is only in the email. */
function hashResetToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Password changes for signed-in users and the emailed reset flow. Either one signs the account
 * out everywhere by revoking its refresh tokens.
 */
@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly activity: AccountActivityService,
  ) {}

  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw apiError(NotFoundException, 'USER_NOT_FOUND');
    }

    if (!user.passwordHash) {
      throw apiError(BadRequestException, 'AUTH_PASSWORD_NOT_SET');
    }

    const validPassword = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!validPassword) {
      throw apiError(UnauthorizedException, 'AUTH_CURRENT_PASSWORD_INCORRECT');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.userRepository.save(user);

    // Invalidate all refresh tokens
    await this.refreshTokenRepository.delete({ userId });
    await this.activity.record(userId, 'password_changed');

    return { success: true, message: 'Password changed successfully' };
  }

  /**
   * Answers every address the same, after the same work: the account lookup. Storing a local
   * account's reset token and emailing its link happen after the answer, so neither the database
   * write nor the mail server makes an existing account answer slower than an unknown one.
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (user?.authProvider === 'local' && !user.deletedAt) {
      void this.sendResetLink(user).catch((error: unknown) => {
        this.logger.warn('Password reset link not sent', {
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          userId: user.id,
        });
      });
    }

    return { success: true, message: FORGOT_PASSWORD_MESSAGE };
  }

  /** Stores a new reset token for the account (replacing any earlier one) and emails its link. */
  private async sendResetLink(user: User): Promise<void> {
    const resetToken = crypto.randomBytes(32).toString('hex');
    await this.userRepository.update(
      { id: user.id },
      { resetToken: hashResetToken(resetToken), resetTokenExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    );

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    await this.emailService.sendPasswordResetEmail(
      user.email,
      `${frontendUrl}/reset-password?token=${resetToken}`,
    );
  }

  /**
   * Sets the new password from an emailed link. The link is claimed in the same statement that
   * changes the password, so it works once even when two requests race, and only while it is
   * unexpired and the account is not deleted. Every session of the account is signed out, and a
   * pending two-factor challenge (started with the old password) is dropped, all in one
   * transaction. Two-factor sign-in stays on: the reset does not sign in.
   */
  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const passwordHash = await bcrypt.hash(newPassword, 12);

    const userId = await this.userRepository.manager.transaction(async (manager) => {
      const claimed = await manager
        .createQueryBuilder()
        .update(User)
        .set({
          passwordHash,
          resetToken: null,
          resetTokenExpires: null,
          twoFactorChallengeTokenHash: null,
          twoFactorChallengeCodeHash: null,
          twoFactorChallengePurpose: null,
          twoFactorChallengeExpires: null,
        })
        .where('reset_token = :tokenHash', { tokenHash: hashResetToken(token) })
        .andWhere('reset_token_expires > :now', { now: new Date() })
        .andWhere('deleted_at IS NULL')
        .returning('id')
        .execute();
      const id = (claimed.raw as Array<{ id?: number }> | undefined)?.[0]?.id;
      if (id) {
        await manager.delete(RefreshToken, { userId: id });
      }
      return id;
    });

    if (!userId) {
      throw apiError(BadRequestException, 'AUTH_INVALID_RESET_TOKEN');
    }
    await this.activity.record(userId, 'password_reset');

    return { success: true, message: 'Password reset successfully' };
  }
}
