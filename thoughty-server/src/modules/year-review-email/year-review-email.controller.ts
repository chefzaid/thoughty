import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '@/common/decorators';
import { OptInEmailSettingsDto, UpdateOptInEmailDto } from '@/modules/opt-in-email/dto';
import { YearReviewEmailService } from './year-review-email.service';

@ApiTags('Year in review email')
@ApiBearerAuth()
@Controller('year-review-email')
export class YearReviewEmailController {
  constructor(private readonly yearReviewEmailService: YearReviewEmailService) {}

  @Get()
  @ApiOperation({ summary: 'Get the year in review email setting (off until turned on)' })
  @ApiResponse({ status: 200, description: 'The setting', type: OptInEmailSettingsDto })
  get(@CurrentUser() user: AuthenticatedUser): Promise<OptInEmailSettingsDto> {
    return this.yearReviewEmailService.get(user.userId);
  }

  @Put()
  @ApiOperation({
    summary: 'Turn the year in review email on or off and choose its hour, time zone and diary',
    description: 'Once on, it arrives on January 1 at that local hour, about the year just ended, when that year has entries.',
  })
  @ApiResponse({ status: 200, description: 'The saved setting', type: OptInEmailSettingsDto })
  @ApiResponse({ status: 400, description: 'Invalid hour or unknown time zone' })
  @ApiResponse({ status: 404, description: 'The diary does not belong to you' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateOptInEmailDto): Promise<OptInEmailSettingsDto> {
    return this.yearReviewEmailService.update(user.userId, dto);
  }
}
