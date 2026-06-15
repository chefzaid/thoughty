import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async sendVerificationEmail(userId: number): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.emailVerified) {
      return { success: true, message: 'Email already verified' };
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
      console.log('Email verification email not sent:', (error as Error).message);
      console.log(`Verification URL: ${verificationUrl}`);
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
      throw new BadRequestException('Invalid or expired verification token');
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpires = null;
    await this.userRepository.save(user);

    return { success: true, message: 'Email verified successfully' };
  }
}
