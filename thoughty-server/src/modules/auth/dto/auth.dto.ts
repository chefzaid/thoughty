import {
  IsEmail,
  IsIn,
  IsString,
  MinLength,
  Matches,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { STRONG_PASSWORD_DESCRIPTION, StrongPassword } from './strong-password.decorator';
import { DELIVERABLE_EMAIL_DESCRIPTION, DeliverableEmail } from './deliverable-email.decorator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com', description: DELIVERABLE_EMAIL_DESCRIPTION })
  @DeliverableEmail()
  email: string;

  @ApiProperty({ example: 'Password123!', description: STRONG_PASSWORD_DESCRIPTION })
  @StrongPassword()
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
  @ApiProperty({ example: 'google', enum: ['google'] })
  @IsIn(['google'])
  provider: 'google';

  @ApiProperty({
    description:
      'The Google ID token (the `credential` from Google Identity Services), sent unmodified. ' +
      'The server verifies its signature, issuer, audience, and expiry and reads the identity ' +
      'from it; the email must be verified by Google.',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(4096)
  credential: string;
}

export class AccessTokenResponseDto {
  @ApiProperty({ description: 'Short-lived access token; keep it in memory only' })
  accessToken: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword: string;

  @ApiProperty({ description: STRONG_PASSWORD_DESCRIPTION })
  @StrongPassword()
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

  @ApiProperty({ description: STRONG_PASSWORD_DESCRIPTION })
  @StrongPassword()
  newPassword: string;
}

/** The address that replaces an account's placeholder (it had none). */
export class AddEmailDto {
  @ApiProperty({ example: 'writer@example.com', description: DELIVERABLE_EMAIL_DESCRIPTION })
  @DeliverableEmail()
  email: string;
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

const EMAIL_MISSING_DESCRIPTION =
  'True when the account has no real address: `email` is then a placeholder on the reserved `.invalid` domain, ' +
  'no mail is ever sent to it, and the writer is asked for an address (`POST /api/auth/add-email`).';
const PENDING_EMAIL_DESCRIPTION =
  'The address given in place of the placeholder, until the link sent to it is opened (`POST /api/auth/verify-email`).';

/** The signed-in user a new session reports. */
export class AuthUserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'writer@example.com' })
  email: string;

  @ApiProperty({ example: 'writer' })
  username: string;

  @ApiProperty({ enum: ['local', 'google', 'keycloak'] })
  authProvider: string;

  @ApiProperty()
  emailVerified: boolean;

  @ApiProperty({ description: EMAIL_MISSING_DESCRIPTION })
  emailMissing: boolean;

  @ApiPropertyOptional({ description: PENDING_EMAIL_DESCRIPTION, example: 'writer@example.com' })
  pendingEmail?: string;

  @ApiProperty()
  twoFactorEnabled: boolean;

  @ApiPropertyOptional({ description: 'Sent by sign-in flows that can create the account (OAuth); true when it did' })
  isNewUser?: boolean;
}

export class AuthResponseDto {
  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;

  @ApiProperty({
    description:
      'Short-lived access token; keep it in memory only. The refresh token is set as an ' +
      'httpOnly cookie scoped to /api/auth and never appears in a response body.',
  })
  accessToken: string;
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

  @ApiProperty({ enum: ['local', 'google', 'keycloak'] })
  authProvider: string;

  @ApiProperty()
  emailVerified: boolean;

  @ApiProperty({ description: EMAIL_MISSING_DESCRIPTION })
  emailMissing: boolean;

  @ApiPropertyOptional({ description: PENDING_EMAIL_DESCRIPTION, example: 'writer@example.com' })
  pendingEmail?: string;

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
