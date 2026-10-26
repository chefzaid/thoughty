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
import { MoreThan, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { RefreshToken, User } from '@/database/entities';
import { ChangePasswordDto } from '../dto';
import { EmailService } from './email.service';

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

    return { success: true, message: 'Password changed successfully' };
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration
    const successMessage = 'If an account exists with this email, a reset link will be sent.';

    if (user?.authProvider !== 'local' || user.deletedAt) {
      return { success: true, message: successMessage };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

    user.resetToken = resetTokenHash;
    user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await this.userRepository.save(user);

    // Send email
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Not awaited: waiting on the mail server would make existing accounts answer measurably
    // slower than unknown addresses.
    void this.emailService.sendPasswordResetEmail(user.email, resetUrl).catch((error: unknown) => {
      this.logger.warn('Password reset email not sent', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown email provider error',
        userId: user.id,
      });
    });

    return { success: true, message: successMessage };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ success: boolean; message: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.userRepository.findOne({
      where: {
        resetToken: tokenHash,
        resetTokenExpires: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw apiError(BadRequestException, 'AUTH_INVALID_RESET_TOKEN');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.resetToken = null;
    user.resetTokenExpires = null;
    await this.userRepository.save(user);

    // Invalidate all refresh tokens
    await this.refreshTokenRepository.delete({ userId: user.id });

    return { success: true, message: 'Password reset successfully' };
  }
}
