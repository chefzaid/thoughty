import { Body, Controller, Get, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '@/common/decorators';
import { OptInEmailSettingsDto, UpdateOptInEmailDto } from '@/modules/opt-in-email/dto';
import { DiaryWritingReminderService } from './diary-writing-reminder.service';
import { DiaryWritingRemindersDto, UpdateDiaryWritingReminderDto } from './dto';
import { WritingReminderEmailService } from './writing-reminder-email.service';

@ApiTags('Writing reminder email')
@ApiBearerAuth()
@Controller('writing-reminder-email')
export class WritingReminderEmailController {
  constructor(
    private readonly writingReminderEmailService: WritingReminderEmailService,
    private readonly diaryWritingReminderService: DiaryWritingReminderService,
  ) {}

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
      '(in the chosen diary, or in any diary when it is null), and opens the journal on that diary. ' +
      'The diaries’ own reminders move to the new time zone.',
  })
  @ApiResponse({ status: 200, description: 'The saved setting', type: OptInEmailSettingsDto })
  @ApiResponse({ status: 400, description: 'Invalid hour or unknown time zone' })
  @ApiResponse({ status: 404, description: 'The diary does not belong to you' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateOptInEmailDto): Promise<OptInEmailSettingsDto> {
    return this.writingReminderEmailService.update(user.userId, dto);
  }

  @Get('diaries')
  @ApiOperation({ summary: 'List the diaries that have their own writing reminder hour' })
  @ApiResponse({ status: 200, description: 'The diaries’ own reminders', type: DiaryWritingRemindersDto })
  listDiaries(@CurrentUser() user: AuthenticatedUser): Promise<DiaryWritingRemindersDto> {
    return this.diaryWritingReminderService.list(user.userId);
  }

  @Put('diaries/:diaryId')
  @ApiOperation({
    summary: 'Give a diary its own writing reminder hour, or remove it',
    description:
      'The diary is then reminded every day at that local hour, in the account reminder’s time zone, unless it has ' +
      'an entry dated that day, and the Profile reminder no longer reminds about it. It works whether or not the ' +
      'Profile reminder is on, and its email’s unsubscribe link stops every writing reminder.',
  })
  @ApiResponse({ status: 200, description: 'The diaries’ own reminders', type: DiaryWritingRemindersDto })
  @ApiResponse({ status: 400, description: 'Invalid hour or unknown time zone' })
  @ApiResponse({ status: 404, description: 'The diary does not belong to you' })
  updateDiary(
    @CurrentUser() user: AuthenticatedUser,
    @Param('diaryId', ParseIntPipe) diaryId: number,
    @Body() dto: UpdateDiaryWritingReminderDto,
  ): Promise<DiaryWritingRemindersDto> {
    return this.diaryWritingReminderService.update(user.userId, diaryId, dto);
  }
}
