import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { apiError } from '@/common/errors';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as crypto from 'node:crypto';
import { MoreThan, Repository } from 'typeorm';
import { User } from '@/database/entities';
import { EmailService } from './email.service';

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
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Emails a new verification link. Registration sends one whatever happens and only logs a failure;
   * a writer who asks for it again (`requireDelivery`) is told when no mail server is configured
   * instead of being told it was sent.
   */
  async sendVerificationEmail(
    userId: number,
    { requireDelivery = false }: { requireDelivery?: boolean } = {},
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw apiError(NotFoundException, 'USER_NOT_FOUND');
    }

    if (user.emailVerified) {
      return { success: true, message: 'Email already verified' };
    }

    if (requireDelivery && !this.emailService.isConfigured()) {
      throw apiError(ServiceUnavailableException, 'EMAIL_DELIVERY_NOT_CONFIGURED');
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = hashToken(token);
    user.emailVerificationTokenExpires = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    await this.userRepository.save(user);

    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

    try {
      await this.emailService.sendEmailVerificationEmail(user.email, verificationUrl);
    } catch (error) {
      this.logger.warn('Email verification email not sent', {
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : 'Unknown email provider error',
        userId: user.id,
      });
    }

    return { success: true, message: 'Verification email sent' };
  }

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

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpires = null;
    await this.userRepository.save(user);

    return { success: true, message: 'Email verified successfully' };
  }
}
