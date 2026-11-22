import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '@/common/decorators';
import { OptInEmailSettingsDto, UpdateOptInEmailDto } from '@/modules/opt-in-email/dto';
import { WritingReminderEmailService } from './writing-reminder-email.service';

@ApiTags('Writing reminder email')
@ApiBearerAuth()
@Controller('writing-reminder-email')
export class WritingReminderEmailController {
  constructor(private readonly writingReminderEmailService: WritingReminderEmailService) {}

  @Get()
  @ApiOperation({ summary: 'Get the writing reminder email setting (off until turned on)' })
  @ApiResponse({ status: 200, description: 'The setting', type: OptInEmailSettingsDto })
  get(@CurrentUser() user: AuthenticatedUser): Promise<OptInEmailSettingsDto> {
    return this.writingReminderEmailService.get(user.userId);
  }

  @Put()
  @ApiOperation({
    summary: 'Turn the writing reminder email on or off and choose its hour, time zone and diary',
    description:
      'Once on, it arrives every day at that local hour, unless the writer already has an entry dated that day ' +
      '(in the chosen diary, or in any diary when it is null), and opens the journal on that diary.',
  })
  @ApiResponse({ status: 200, description: 'The saved setting', type: OptInEmailSettingsDto })
  @ApiResponse({ status: 400, description: 'Invalid hour or unknown time zone' })
  @ApiResponse({ status: 404, description: 'The diary does not belong to you' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateOptInEmailDto): Promise<OptInEmailSettingsDto> {
    return this.writingReminderEmailService.update(user.userId, dto);
  }
}
