import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Delete,
  Headers,
  Param,
  ParseIntPipe,
  Req,
  Res,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  REFRESH_TOKEN_COOKIE,
  clearRefreshTokenCookie,
  readRefreshTokenCookie,
  setRefreshTokenCookie,
} from './refresh-token-cookie';
import {
  AccessTokenResponseDto,
  RegisterDto,
  LoginDto,
  OAuthDto,
  RefreshTokenDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  DeleteAccountDto,
  AuthResponseDto,
  SessionResponseDto,
  UserResponseDto,
  TwoFactorChallengeResponseDto,
  TwoFactorCodeDto,
  TwoFactorResendDto,
  DisableTwoFactorDto,
  TwoFactorStatusResponseDto,
} from './dto';
import {
  AccountService,
  AuthService,
  AuthSessionService,
  EmailVerificationService,
  type IssuedSession,
  PasswordService,
  TwoFactorService,
} from './services';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public, CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { SuccessMessageResponseDto, SuccessResponseDto } from '@/common/dto';
import { RATE_LIMITS, throttleDefault } from '@/common';

const REFRESH_COOKIE_NOTE = `Sets the httpOnly \`${REFRESH_TOKEN_COOKIE}\` refresh token cookie (path /api/auth).`;

@ApiTags('Authentication')
@ApiExtraModels(AuthResponseDto, TwoFactorChallengeResponseDto)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: AuthSessionService,
    private readonly passwordService: PasswordService,
    private readonly accountService: AccountService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  /** Moves a new session's refresh token into its cookie and returns the rest. */
  private startSession(res: Response, session: IssuedSession): AuthResponseDto {
    const { refreshToken, ...response } = session;
    setRefreshTokenCookie(res, refreshToken);
    return response;
  }

  @Public()
  @Post('register')
  @Throttle(throttleDefault(RATE_LIMITS.authAttempt))
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: `User registered and signed in. ${REFRESH_COOKIE_NOTE}`,
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(dto);
    await this.emailVerificationService.sendVerificationEmail(result.user.id);
    return this.startSession(res, result);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.authAttempt))
  @ApiOperation({ summary: 'Login with email/username and password' })
  @ApiResponse({
    status: 200,
    description: `The session, or an email-code challenge when two-factor authentication is enabled. ${REFRESH_COOKIE_NOTE}`,
    schema: {
      oneOf: [
        { $ref: getSchemaPath(AuthResponseDto) },
        { $ref: getSchemaPath(TwoFactorChallengeResponseDto) },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto | TwoFactorChallengeResponseDto> {
    const result = await this.authService.login(dto);
    return 'refreshToken' in result ? this.startSession(res, result) : result;
  }

  @Public()
  @Post('two-factor/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.authAttempt))
  @ApiOperation({ summary: 'Verify an email code and finish password login' })
  @ApiResponse({
    status: 200,
    description: `Login completed. ${REFRESH_COOKIE_NOTE}`,
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or already-used challenge' })
  async verifyTwoFactor(
    @Body() dto: TwoFactorCodeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.startSession(res, await this.authService.verifyTwoFactorLogin(dto));
  }

  @Public()
  @Post('two-factor/resend')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.authAttempt))
  @ApiOperation({ summary: 'Replace an active challenge and send a new email code' })
  @ApiResponse({
    status: 200,
    description: 'Replacement single-use challenge',
    type: TwoFactorChallengeResponseDto,
  })
  async resendTwoFactor(@Body() dto: TwoFactorResendDto): Promise<TwoFactorChallengeResponseDto> {
    return this.twoFactorService.resend(dto.challengeToken);
  }

  @Get('two-factor/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get two-factor availability and current status' })
  @ApiResponse({
    status: 200,
    description: 'Current two-factor status',
    type: TwoFactorStatusResponseDto,
  })
  async twoFactorStatus(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TwoFactorStatusResponseDto> {
    return this.twoFactorService.status(user.userId);
  }

  @Post('two-factor/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(throttleDefault(RATE_LIMITS.accountSecurity))
  @ApiOperation({ summary: 'Email a code to start enabling two-factor authentication' })
  @ApiResponse({
    status: 201,
    description: 'Single-use setup challenge',
    type: TwoFactorChallengeResponseDto,
  })
  async setupTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TwoFactorChallengeResponseDto> {
    return this.twoFactorService.startSetup(user.userId);
  }

  @Post('two-factor/enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(throttleDefault(RATE_LIMITS.accountSecurity))
  @ApiOperation({ summary: 'Confirm the setup code and enable two-factor authentication' })
  @ApiResponse({ status: 200, description: 'Two-factor authentication enabled', type: SuccessResponseDto })
  async enableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<SuccessResponseDto> {
    return this.twoFactorService.enable(user.userId, dto);
  }

  @Post('two-factor/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(throttleDefault(RATE_LIMITS.accountSecurity))
  @ApiOperation({ summary: 'Disable two-factor authentication after password confirmation' })
  @ApiResponse({ status: 200, description: 'Two-factor authentication disabled', type: SuccessResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  async disableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DisableTwoFactorDto,
  ): Promise<SuccessResponseDto> {
    return this.twoFactorService.disable(user.userId, dto.password);
  }

  @Public()
  @Post('oauth')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.authAttempt))
  @ApiOperation({ summary: 'Sign in with a verified Google ID token' })
  @ApiResponse({
    status: 200,
    description: `Google sign-in successful. ${REFRESH_COOKIE_NOTE}`,
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  @ApiResponse({ status: 401, description: 'Invalid Google credential or unverified email' })
  @ApiResponse({ status: 503, description: 'Google sign-in is not configured on this server' })
  async oauth(
    @Body() dto: OAuthDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.startSession(res, await this.authService.oauthLogin(dto));
  }

  @Public()
  @Get('sso')
  @ApiOperation({ summary: 'Exchange the ingress-validated Keycloak identity for an app session' })
  @ApiResponse({
    status: 200,
    description: `SSO authentication successful. ${REFRESH_COOKIE_NOTE}`,
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid Keycloak identity' })
  async sso(
    @Res({ passthrough: true }) res: Response,
    @Headers('x-auth-request-access-token') accessToken?: string,
  ): Promise<AuthResponseDto> {
    return this.startSession(res, await this.authService.keycloakLogin(accessToken));
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.tokenRefresh))
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiOperation({
    summary: 'Exchange the refresh token cookie for a new access token',
    description:
      'Each refresh token works once: it is replaced by a new one in the cookie, and reusing ' +
      'the old one fails.',
  })
  @ApiResponse({
    status: 200,
    description: `New access token. ${REFRESH_COOKIE_NOTE}`,
    type: AccessTokenResponseDto,
  })
  @ApiBody({ type: RefreshTokenDto, required: false })
  @ApiResponse({ status: 401, description: 'Missing, invalid, expired, or reused refresh token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RefreshTokenDto,
  ): Promise<AccessTokenResponseDto> {
    try {
      const { accessToken, refreshToken } = await this.sessionService.refreshToken(
        readRefreshTokenCookie(req) ?? dto?.refreshToken,
      );
      setRefreshTokenCookie(res, refreshToken);
      return { accessToken };
    } catch (error) {
      // A rejected token is dropped; a transient failure keeps the cookie for a retry.
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        clearRefreshTokenCookie(res);
      }
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiOperation({ summary: 'Logout, revoke the refresh token, and clear its cookie' })
  @ApiResponse({ status: 200, description: 'Logged out successfully', type: SuccessResponseDto })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SuccessResponseDto> {
    clearRefreshTokenCookie(res);
    return this.sessionService.logout(readRefreshTokenCookie(req));
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiOperation({
    summary: 'List active sessions for the current user',
    description: 'The session of the refresh token cookie is marked current.',
  })
  @ApiResponse({ status: 200, description: 'Active sessions', type: [SessionResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<SessionResponseDto[]> {
    return this.sessionService.listSessions(user.userId, readRefreshTokenCookie(req));
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.accountSecurity))
  @ApiBearerAuth()
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiOperation({
    summary: 'Revoke all other active sessions',
    description: 'The session of the refresh token cookie is kept.',
  })
  @ApiResponse({ status: 200, description: 'Other sessions revoked', type: SuccessResponseDto })
  @ApiResponse({ status: 400, description: 'Refresh token cookie missing' })
  async revokeOtherSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<SuccessResponseDto> {
    return this.sessionService.revokeOtherSessions(user.userId, readRefreshTokenCookie(req));
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.accountSecurity))
  @ApiBearerAuth()
  @ApiCookieAuth(REFRESH_TOKEN_COOKIE)
  @ApiOperation({
    summary: 'Revoke one active session',
    description: 'The session of the refresh token cookie cannot be revoked here; use logout.',
  })
  @ApiResponse({ status: 200, description: 'Session revoked', type: SuccessResponseDto })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) sessionId: number,
    @Req() req: Request,
  ): Promise<SuccessResponseDto> {
    return this.sessionService.revokeSession(user.userId, sessionId, readRefreshTokenCookie(req));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user info' })
  @ApiResponse({ status: 200, description: 'Current user info', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    return this.accountService.getMe(user.userId);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.accountSecurity))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully', type: SuccessMessageResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized or incorrect current password' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<SuccessMessageResponseDto> {
    return this.passwordService.changePassword(user.userId, dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.passwordRecovery))
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists', type: SuccessMessageResponseDto })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<SuccessMessageResponseDto> {
    return this.passwordService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.passwordRecovery))
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully', type: SuccessMessageResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<SuccessMessageResponseDto> {
    return this.passwordService.resetPassword(dto.token, dto.newPassword);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.passwordRecovery))
  @ApiOperation({ summary: 'Verify email with token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully', type: SuccessMessageResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<SuccessMessageResponseDto> {
    return this.emailVerificationService.verifyEmail(dto.token);
  }

  @Post('resend-verification-email')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.accountSecurity))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend the current user email verification message' })
  @ApiResponse({ status: 200, description: 'Verification email sent if needed', type: SuccessMessageResponseDto })
  @ApiResponse({ status: 503, description: 'No mail server is configured (`EMAIL_DELIVERY_NOT_CONFIGURED`)' })
  async resendVerificationEmail(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SuccessMessageResponseDto> {
    return this.emailVerificationService.sendVerificationEmail(user.userId, { requireDelivery: true });
  }

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.accountSecurity))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user account' })
  @ApiResponse({ status: 200, description: 'Account deleted; the refresh token cookie is cleared', type: SuccessMessageResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SuccessMessageResponseDto> {
    const result = await this.accountService.deleteAccount(user.userId, dto.password);
    clearRefreshTokenCookie(res);
    return result;
  }
}
