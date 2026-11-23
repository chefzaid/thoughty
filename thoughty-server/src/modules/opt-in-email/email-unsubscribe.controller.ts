import { Controller, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '@/common/decorators';
import { RATE_LIMITS, throttleDefault } from '@/common';
import { EmailUnsubscribeQueryDto, EmailUnsubscribeResultDto } from './dto';
import { EmailUnsubscribeService } from './email-unsubscribe.service';

@ApiTags('Email unsubscribe')
@Controller('email-unsubscribe')
export class EmailUnsubscribeController {
  constructor(private readonly emailUnsubscribeService: EmailUnsubscribeService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle(throttleDefault(RATE_LIMITS.tokenRefresh))
  @ApiOperation({
    summary: 'Stop the opt-in email an email’s signed link names, without signing in',
    description:
      'The token says which email it turns off ("On this day", the monthly recap, the writing reminder or the year in review). ' +
      'The web unsubscribe page posts here, and the one-click unsubscribe header of the monthly recap, the writing reminder ' +
      'and the year in review too (RFC 8058, ' +
      '`List-Unsubscribe=One-Click` in the body). Repeating it changes nothing.',
  })
  @ApiResponse({ status: 200, description: 'The email is off', type: EmailUnsubscribeResultDto })
  @ApiResponse({ status: 400, description: 'The link is invalid' })
  unsubscribe(@Query() query: EmailUnsubscribeQueryDto): Promise<EmailUnsubscribeResultDto> {
    return this.emailUnsubscribeService.unsubscribe(query.token);
  }
}
