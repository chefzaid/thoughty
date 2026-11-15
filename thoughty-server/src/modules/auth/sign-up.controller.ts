import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from '@/common/decorators';
import { RATE_LIMITS, throttleDefault } from '@/common';
import {
  AuthResponseDto,
  CompleteSignUpDto,
  RegisterDto,
  SignUpStartedResponseDto,
} from './dto';
import { REFRESH_COOKIE_NOTE, startSession } from './refresh-token-cookie';
import { SignUpService } from './services';

/** Creating a local account: verify-first wherever the server can send email (`SignUpService`). */
@ApiTags('Authentication')
@ApiExtraModels(SignUpStartedResponseDto)
@Controller('auth')
export class SignUpController {
  constructor(private readonly signUpService: SignUpService) {}

  @Public()
  @Post('register')
  @Throttle(throttleDefault(RATE_LIMITS.authAttempt))
  @ApiOperation({
    summary: 'Start a sign-up',
    description:
      'Where the server can send email, no account is created yet: every address gets the same ' +
      '`202` answer, a new one an email with a single-use link to `POST /api/auth/register/complete` ' +
      'and one that already has an account a notice to sign in instead. Only outside production ' +
      'and without a mail server is the account created and signed in at once (`201`).',
  })
  @ApiResponse({
    status: 202,
    description: 'Check your email: the same answer whether or not the address has an account',
    type: SignUpStartedResponseDto,
  })
  @ApiResponse({
    status: 201,
    description: `No mail server, outside production only: registered and signed in. ${REFRESH_COOKIE_NOTE}`,
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error; a password too weak is `AUTH_WEAK_PASSWORD`' })
  @ApiResponse({ status: 409, description: 'Email or username taken (only when signed in at once)' })
  @ApiResponse({
    status: 503,
    description: 'Production without a mail server (`EMAIL_DELIVERY_NOT_CONFIGURED`)',
  })
  async register(@Body() dto: RegisterDto, @Res() res: Response): Promise<void> {
    // Sent here because the status depends on the answer, and Nest would reply 201 for both
    const result = await this.signUpService.register(dto);
    if ('verificationRequired' in result) {
      res.status(HttpStatus.ACCEPTED).json(result);
      return;
    }
    res.status(HttpStatus.CREATED).json(startSession(res, result));
  }

  @Public()
  @Post('register/complete')
  @Throttle(throttleDefault(RATE_LIMITS.authAttempt))
  @ApiOperation({
    summary: 'Create the account from an emailed sign-up link and sign in',
    description:
      'The link works once and for 24 hours, and needs the password chosen on the sign-up form. ' +
      'A username already taken answers `409` and keeps the link working, so another can be sent.',
  })
  @ApiResponse({
    status: 201,
    description: `Account created with a verified email and signed in. ${REFRESH_COOKIE_NOTE}`,
    type: AuthResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid, expired, or used link (`AUTH_INVALID_SIGN_UP_TOKEN`)',
  })
  @ApiResponse({ status: 401, description: 'Not the password chosen on the sign-up form' })
  @ApiResponse({
    status: 409,
    description: 'Username taken, or the address got an account meanwhile',
  })
  async complete(
    @Body() dto: CompleteSignUpDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return startSession(res, await this.signUpService.complete(dto));
  }
}
