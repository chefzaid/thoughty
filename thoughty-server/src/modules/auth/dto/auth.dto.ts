import { IsEmail, IsString, MinLength, Matches, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(255)
  email: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  password: string;

  @ApiPropertyOptional({ example: 'johndoe' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username can only contain letters, numbers, underscores, and hyphens',
  })
  username?: string;

  @ApiPropertyOptional({ description: 'Hidden bot-trap field; must be left empty by real users' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  website?: string;
}

export class LoginDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email or username' })
  @IsString()
  identifier: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ description: 'Hidden bot-trap field; must be left empty by real users' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  website?: string;
}

export class OAuthDto {
  @ApiProperty({ example: 'google', enum: ['google', 'facebook'] })
  @IsString()
  provider: 'google' | 'facebook';

  @ApiProperty({ example: '123456789' })
  @IsString()
  providerId: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  newPassword: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>]).{8,}$/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
  })
  newPassword: string;
}

export class VerifyEmailDto {
  @ApiProperty()
  @IsString()
  token: string;
}

export class DeleteAccountDto {
  @ApiPropertyOptional({ description: 'Password required for local accounts' })
  @IsOptional()
  @IsString()
  password?: string;
}

export class AuthResponseDto {
  @ApiProperty()
  user: {
    id: number;
    email: string;
    username: string;
    authProvider: string;
    emailVerified: boolean;
    twoFactorEnabled: boolean;
    isNewUser?: boolean;
  };

  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;
}

export class TwoFactorChallengeResponseDto {
  @ApiProperty({ example: true })
  twoFactorRequired: true;

  @ApiProperty({ description: 'Opaque single-use challenge token' })
  challengeToken: string;

  @ApiProperty({ example: 600 })
  expiresInSeconds: number;
}

export class TwoFactorCodeDto {
  @ApiProperty({ description: 'Opaque challenge token returned when the code was requested' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  challengeToken: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Code must contain exactly 6 digits' })
  code: string;
}

export class TwoFactorResendDto {
  @ApiProperty({ description: 'Current opaque challenge token' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  challengeToken: string;
}

export class DisableTwoFactorDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  password: string;
}

export class TwoFactorStatusResponseDto {
  @ApiProperty()
  enabled: boolean;

  @ApiProperty({ description: 'Whether email delivery is configured on this server' })
  available: boolean;

  @ApiProperty()
  emailVerified: boolean;
}

export class UserResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;

  @ApiPropertyOptional()
  avatarUrl?: string;

  @ApiProperty()
  authProvider: string;

  @ApiProperty()
  emailVerified: boolean;

  @ApiProperty()
  twoFactorEnabled: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class SessionResponseDto {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty({ example: true })
  current: boolean;

  @ApiProperty({ example: '2026-06-21T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-06-28T10:00:00.000Z' })
  expiresAt: Date;
}
