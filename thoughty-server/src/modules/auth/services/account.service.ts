import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { RefreshToken, User } from '@/database/entities';
import { UserResponseDto } from '../dto';
import { EmailService } from './email.service';

/** The signed-in user's own account: reading its profile and deleting it. */
@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly emailService: EmailService,
  ) {}

  async getMe(userId: number): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl || undefined,
      authProvider: user.authProvider,
      emailVerified: user.emailVerified,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      createdAt: user.createdAt,
    };
  }

  async deleteAccount(
    userId: number,
    password?: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // For local accounts, verify password
    if (user.authProvider === 'local') {
      if (!password) {
        throw new BadRequestException('Password is required to delete account');
      }

      const validPassword = await bcrypt.compare(password, user.passwordHash || '');
      if (!validPassword) {
        throw new UnauthorizedException('Invalid password');
      }
    }

    // Soft delete
    user.deletedAt = new Date();
    user.deletionReason = 'User requested deletion';
    await this.userRepository.save(user);

    // Invalidate all refresh tokens
    await this.refreshTokenRepository.delete({ userId });

    // Send deletion email
    try {
      await this.emailService.sendAccountDeletionEmail(user.email);
    } catch (error) {
      this.logger.warn('Account deletion email not sent', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown email provider error',
        userId,
      });
    }

    return { success: true, message: 'Account has been deleted' };
  }
}
