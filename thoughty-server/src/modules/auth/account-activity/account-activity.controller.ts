import { Body, Controller, Get, HttpCode, HttpStatus, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { RATE_LIMITS, throttleDefault } from '@/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AccountActivityService } from './account-activity.service';
import {
  AccountActivityQueryDto,
  AccountActivityResponseDto,
  NewBrowserEmailDto,
  NewBrowserEmailResponseDto,
} from './dto';

@ApiTags('Authentication')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('auth/activity')
export class AccountActivityController {
  constructor(private readonly activity: AccountActivityService) {}

  @Get()
  @ApiOperation({
    summary: 'List the account’s activity of the past year',
    description:
      'Sign-ins and refused sign-ins, sign-outs, password and two-factor changes, PIN changes, data downloads ' +
      'and exports, and private share links made or revoked, each with its browser and system (no IP address).',
  })
  @ApiResponse({ status: 200, description: 'One page of events, newest first', type: AccountActivityResponseDto })
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: AccountActivityQueryDto,
  ): Promise<AccountActivityResponseDto> {
    return this.activity.list(user.userId, query.before);
  }

  @Put('new-browser-email')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.accountSecurity))
  @ApiOperation({ summary: 'Turn the email about a sign-in from a new browser on or off' })
  @ApiResponse({ status: 200, description: 'The setting as saved', type: NewBrowserEmailResponseDto })
  async setNewBrowserEmail(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: NewBrowserEmailDto,
  ): Promise<NewBrowserEmailResponseDto> {
    return { newBrowserEmail: await this.activity.setNewBrowserEmail(user.userId, dto.enabled) };
  }
}
