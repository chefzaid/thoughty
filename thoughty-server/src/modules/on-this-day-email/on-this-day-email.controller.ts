import { Body, Controller, Get, HttpCode, HttpStatus, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser, CurrentUser, Public } from '@/common/decorators';
import { SuccessResponseDto } from '@/common/dto';
import { RATE_LIMITS, throttleDefault } from '@/common';
import { OnThisDayEmailSettingsDto, UnsubscribeOnThisDayEmailQueryDto, UpdateOnThisDayEmailDto } from './dto';
import { OnThisDayEmailService } from './on-this-day-email.service';

@ApiTags('On this day email')
@Controller('on-this-day-email')
export class OnThisDayEmailController {
  constructor(private readonly onThisDayEmailService: OnThisDayEmailService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the "On this day" email setting (off until turned on)' })
  @ApiResponse({ status: 200, description: 'The setting', type: OnThisDayEmailSettingsDto })
  get(@CurrentUser() user: AuthenticatedUser): Promise<OnThisDayEmailSettingsDto> {
    return this.onThisDayEmailService.get(user.userId);
  }

  @Put()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Turn the "On this day" email on or off and choose its hour, time zone and diary' })
  @ApiResponse({ status: 200, description: 'The saved setting', type: OnThisDayEmailSettingsDto })
  @ApiResponse({ status: 400, description: 'Invalid hour or unknown time zone' })
  @ApiResponse({ status: 404, description: 'The diary does not belong to you' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateOnThisDayEmailDto): Promise<OnThisDayEmailSettingsDto> {
    return this.onThisDayEmailService.update(user.userId, dto);
  }

  @Public()
  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.tokenRefresh))
  @ApiOperation({
    summary: 'Stop "On this day" emails from an email’s signed link, without signing in',
    description:
      'Mail apps post here for one-click unsubscribe (RFC 8058, `List-Unsubscribe=One-Click` in the body), ' +
      'and the web unsubscribe page does too. Repeating it changes nothing.',
  })
  @ApiResponse({ status: 200, description: 'The email is off', type: SuccessResponseDto })
  @ApiResponse({ status: 400, description: 'The link is invalid' })
  unsubscribe(@Query() query: UnsubscribeOnThisDayEmailQueryDto): Promise<SuccessResponseDto> {
    return this.onThisDayEmailService.unsubscribe(query.token);
  }
}
