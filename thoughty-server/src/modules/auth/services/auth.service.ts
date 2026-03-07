import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'node:crypto';
import { User, RefreshToken, Diary } from '@/database/entities';
import { sanitizeString } from '@/common/utils';
import { EmailService } from './email.service';
import {
  RegisterDto,
  LoginDto,
  OAuthDto,
  ChangePasswordDto,
  AuthResponseDto,
  UserResponseDto,
} from '../dto';

@Injectable()
export class AuthService {
  private readonly refreshSecret: string;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(Diary)
    private readonly diaryRepository: Repository<Diary>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {
    this.refreshSecret = this.configService.get<string>(
      'REFRESH_SECRET',
      'refresh-secret-change-in-production',
    );
  }

  private generateAccessToken(user: { id: number; email: string; username: string }): string {
    return this.jwtService.sign({
      userId: user.id,
      email: user.email,
      username: user.username,
    });
  }

  private generateRefreshToken(user: { id: number }): string {
    return this.jwtService.sign({ userId: user.id }, { secret: this.refreshSecret, expiresIn: '7d' });
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const sanitizedUsername = dto.username
      ? sanitizeString(dto.username.trim()).substring(0, 50)
      : null;

    // Check if email exists
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Generate username from email if not provided
    const username = sanitizedUsername || dto.email.split('@')[0].substring(0, 50);

    // Create user
    const user = await this.userRepository.save({
      username,
      email: dto.email.toLowerCase(),
      passwordHash,
      authProvider: 'local',
      emailVerified: false,
    });

    // Create default diary
    await this.diaryRepository.save({
      userId: user.id,
      name: 'Thoughts',
      icon: '💭',
      isDefault: true,
      visibility: 'private',
    });

    // Generate tokens
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Store refresh token
    await this.refreshTokenRepository.save({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        authProvider: 'local',
      },
      accessToken,
      refreshToken,
    };
  }

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const identifier = sanitizeString(dto.identifier.trim()).toLowerCase();

    // Find user by email or username
    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :identifier OR LOWER(user.username) = :identifier', {
        identifier,
      })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.deletedAt) {
      throw new ForbiddenException(
        'This account has been deleted. Please contact support if you believe this is a mistake.',
      );
    }

    if (user.authProvider !== 'local' && !user.passwordHash) {
      throw new UnauthorizedException(
        `This account uses ${user.authProvider} login. Please sign in with ${user.authProvider}.`,
      );
    }

    const validPassword = await bcrypt.compare(dto.password, user.passwordHash || '');
    if (!validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    await this.refreshTokenRepository.save({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        authProvider: user.authProvider,
      },
      accessToken,
      refreshToken,
    };
  }

  async oauthLogin(dto: OAuthDto): Promise<AuthResponseDto> {
    let user = await this.userRepository.findOne({
      where: { authProvider: dto.provider, providerId: dto.providerId },
    });

    let isNewUser = false;

    if (user) {
      if (user.deletedAt) {
        throw new ForbiddenException(
          'This account has been deleted. Please contact support if you believe this is a mistake.',
        );
      }
    } else {
      // Check if email exists with different auth method
      const existingUser = await this.userRepository.findOne({
        where: { email: dto.email.toLowerCase() },
      });

      if (existingUser) {
        if (existingUser.deletedAt) {
          throw new ForbiddenException(
            'This account has been deleted. Please contact support if you believe this is a mistake.',
          );
        }

        // Link OAuth to existing account
        existingUser.authProvider = dto.provider;
        existingUser.providerId = dto.providerId;
        existingUser.avatarUrl = dto.avatarUrl || existingUser.avatarUrl;
        existingUser.emailVerified = true;
        user = await this.userRepository.save(existingUser);
      } else {
        // Create new user
        isNewUser = true;
        const username = dto.name || dto.email.split('@')[0];
        user = await this.userRepository.save({
          username,
          email: dto.email.toLowerCase(),
          authProvider: dto.provider,
          providerId: dto.providerId,
          avatarUrl: dto.avatarUrl,
          emailVerified: true,
        });

        // Create default diary
        await this.diaryRepository.save({
          userId: user.id,
          name: 'Thoughts',
          icon: '💭',
          isDefault: true,
          visibility: 'private',
        });
      }
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    await this.refreshTokenRepository.save({
      userId: user.id,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        authProvider: dto.provider,
        isNewUser,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      this.jwtService.verify(refreshToken, { secret: this.refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenRecord = await this.refreshTokenRepository.findOne({
      where: { token: refreshToken, expiresAt: MoreThan(new Date()) },
      relations: ['user'],
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    if (tokenRecord.user.deletedAt) {
      await this.refreshTokenRepository.delete({ token: refreshToken });
      throw new ForbiddenException('This account has been deleted.');
    }

    const accessToken = this.generateAccessToken(tokenRecord.user);

    return { accessToken };
  }

  async logout(refreshToken?: string): Promise<{ success: boolean }> {
    if (refreshToken) {
      await this.refreshTokenRepository.delete({ token: refreshToken });
    }
    return { success: true };
  }

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
      createdAt: user.createdAt,
    };
  }

  async changePassword(userId: number, dto: ChangePasswordDto): Promise<{ success: boolean; message: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.passwordHash) {
      throw new BadRequestException('Cannot change password for OAuth accounts without existing password');
    }

    const validPassword = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!validPassword) {
      throw new UnauthorizedException('Current password is incorrect');
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

    if (user?.authProvider !== 'local') {
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

    try {
      await this.emailService.sendPasswordResetEmail(user.email, resetUrl);
    } catch (error) {
      console.log('Password reset email not sent:', (error as Error).message);
      console.log(`Reset URL: ${resetUrl}`);
    }

    return { success: true, message: successMessage };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await this.userRepository.findOne({
      where: {
        resetToken: tokenHash,
        resetTokenExpires: MoreThan(new Date()),
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.resetToken = null;
    user.resetTokenExpires = null;
    await this.userRepository.save(user);

    // Invalidate all refresh tokens
    await this.refreshTokenRepository.delete({ userId: user.id });

    return { success: true, message: 'Password reset successfully' };
  }

  async deleteAccount(userId: number, password?: string): Promise<{ success: boolean; message: string }> {
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
      console.log('Email notification not sent:', (error as Error).message);
    }

    return { success: true, message: 'Account has been deleted' };
  }
}
