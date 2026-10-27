import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '@/common/decorators';
import { OptInEmailSettingsDto, UpdateOptInEmailDto } from '@/modules/opt-in-email/dto';
import { MonthlyRecapEmailService } from './monthly-recap-email.service';

@ApiTags('Monthly recap email')
@ApiBearerAuth()
@Controller('monthly-recap-email')
export class MonthlyRecapEmailController {
  constructor(private readonly monthlyRecapEmailService: MonthlyRecapEmailService) {}

  @Get()
  @ApiOperation({ summary: 'Get the monthly recap email setting (off until turned on)' })
  @ApiResponse({ status: 200, description: 'The setting', type: OptInEmailSettingsDto })
  get(@CurrentUser() user: AuthenticatedUser): Promise<OptInEmailSettingsDto> {
    return this.monthlyRecapEmailService.get(user.userId);
  }

  @Put()
  @ApiOperation({
    summary: 'Turn the monthly recap email on or off and choose its hour, time zone and diary',
    description: 'Once on, it arrives on the 1st of each month at that local hour, about the month just ended.',
  })
  @ApiResponse({ status: 200, description: 'The saved setting', type: OptInEmailSettingsDto })
  @ApiResponse({ status: 400, description: 'Invalid hour or unknown time zone' })
  @ApiResponse({ status: 404, description: 'The diary does not belong to you' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateOptInEmailDto): Promise<OptInEmailSettingsDto> {
    return this.monthlyRecapEmailService.update(user.userId, dto);
  }
}
