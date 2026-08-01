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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './services/auth.service';
import {
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
import { EmailVerificationService, TwoFactorService } from './services';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public, CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { RATE_LIMITS, throttleDefault } from '@/common';

@ApiTags('Authentication')
@ApiExtraModels(AuthResponseDto, TwoFactorChallengeResponseDto)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly twoFactorService: TwoFactorService,
  ) {}

  @Public()
  @Post('register')
  @Throttle(throttleDefault(RATE_LIMITS.authAttempt))
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    const result = await this.authService.register(dto);
    await this.emailVerificationService.sendVerificationEmail(result.user.id);
    return result;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.authAttempt))
  @ApiOperation({ summary: 'Login with email/username and password' })
  @ApiResponse({
    status: 200,
    description:
      'Login tokens, or an email-code challenge when two-factor authentication is enabled',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(AuthResponseDto) },
        { $ref: getSchemaPath(TwoFactorChallengeResponseDto) },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto | TwoFactorChallengeResponseDto> {
    return this.authService.login(dto);
  }

  @Public()
  @Post('two-factor/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.authAttempt))
  @ApiOperation({ summary: 'Verify an email code and finish password login' })
  @ApiResponse({ status: 200, description: 'Login completed', type: AuthResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid, expired, or already-used challenge' })
  async verifyTwoFactor(@Body() dto: TwoFactorCodeDto): Promise<AuthResponseDto> {
    return this.authService.verifyTwoFactorLogin(dto);
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
  @ApiResponse({ status: 200, description: 'Two-factor authentication enabled' })
  async enableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<{ success: boolean }> {
    return this.twoFactorService.enable(user.userId, dto);
  }

  @Post('two-factor/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(throttleDefault(RATE_LIMITS.accountSecurity))
  @ApiOperation({ summary: 'Disable two-factor authentication after password confirmation' })
  @ApiResponse({ status: 200, description: 'Two-factor authentication disabled' })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  async disableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DisableTwoFactorDto,
  ): Promise<{ success: boolean }> {
    return this.twoFactorService.disable(user.userId, dto.password);
  }

  @Public()
  @Post('oauth')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.authAttempt))
  @ApiOperation({ summary: 'Authenticate with OAuth provider' })
  @ApiResponse({
    status: 200,
    description: 'OAuth authentication successful',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Missing required fields' })
  async oauth(@Body() dto: OAuthDto): Promise<AuthResponseDto> {
    return this.authService.oauthLogin(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.tokenRefresh))
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'New access token' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<{ accessToken: string }> {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and invalidate refresh token' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Body() dto: RefreshTokenDto): Promise<{ success: boolean }> {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiHeader({
    name: 'X-Refresh-Token',
    required: false,
    description: 'Current refresh token for marking this session',
  })
  @ApiOperation({ summary: 'List active sessions for the current user' })
  @ApiResponse({ status: 200, description: 'Active sessions', type: [SessionResponseDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-refresh-token') currentRefreshToken?: string,
  ): Promise<SessionResponseDto[]> {
    return this.authService.listSessions(user.userId, currentRefreshToken);
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.accountSecurity))
  @ApiBearerAuth()
  @ApiHeader({
    name: 'X-Refresh-Token',
    required: true,
    description: 'Current refresh token to keep active',
  })
  @ApiOperation({ summary: 'Revoke all other active sessions' })
  @ApiResponse({ status: 200, description: 'Other sessions revoked' })
  @ApiResponse({ status: 400, description: 'Current refresh token missing' })
  async revokeOtherSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Headers('x-refresh-token') currentRefreshToken?: string,
  ): Promise<{ success: boolean }> {
    return this.authService.revokeOtherSessions(user.userId, currentRefreshToken);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.accountSecurity))
  @ApiBearerAuth()
  @ApiHeader({
    name: 'X-Refresh-Token',
    required: false,
    description: 'Current refresh token to protect it from revocation',
  })
  @ApiOperation({ summary: 'Revoke one active session' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) sessionId: number,
    @Headers('x-refresh-token') currentRefreshToken?: string,
  ): Promise<{ success: boolean }> {
    return this.authService.revokeSession(user.userId, sessionId, currentRefreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user info' })
  @ApiResponse({ status: 200, description: 'Current user info', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@CurrentUser() user: AuthenticatedUser): Promise<UserResponseDto> {
    return this.authService.getMe(user.userId);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.accountSecurity))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized or incorrect current password' })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.authService.changePassword(user.userId, dto);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.passwordRecovery))
  @ApiOperation({ summary: 'Request password reset email' })
  @ApiResponse({ status: 200, description: 'Reset email sent if account exists' })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.passwordRecovery))
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @Public()
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.passwordRecovery))
  @ApiOperation({ summary: 'Verify email with token' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ success: boolean; message: string }> {
    return this.emailVerificationService.verifyEmail(dto.token);
  }

  @Post('resend-verification-email')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.accountSecurity))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend the current user email verification message' })
  @ApiResponse({ status: 200, description: 'Verification email sent if needed' })
  async resendVerificationEmail(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ success: boolean; message: string }> {
    return this.emailVerificationService.sendVerificationEmail(user.userId);
  }

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.accountSecurity))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user account' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  @ApiResponse({ status: 401, description: 'Invalid password' })
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
  ): Promise<{ success: boolean; message: string }> {
    return this.authService.deleteAccount(user.userId, dto.password);
  }
}
