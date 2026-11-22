import { Controller, Delete, Get, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { SuccessResponseDto } from '@/common/dto';
import { MULTIPART_FIELD_LIMITS } from '@/common/multipart-limits';
import {
  CALENDAR_FILE_MAX_SIZE,
  CalendarDayResponseDto,
  CalendarEventsQueryDto,
  CalendarImportQueryDto,
  CalendarImportResponseDto,
  CalendarSummaryResponseDto,
} from './dto';
import { CalendarService } from './calendar.service';

@ApiTags('Calendar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get()
  @ApiOperation({ summary: 'How many imported calendar events the writer keeps, and when a calendar was last imported' })
  @ApiResponse({ status: 200, description: 'Imported calendar summary', type: CalendarSummaryResponseDto })
  async summary(@CurrentUser() user: AuthenticatedUser): Promise<CalendarSummaryResponseDto> {
    return this.calendarService.summary(user.userId);
  }

  @Get('events')
  @ApiOperation({ summary: 'The imported calendar events on a day, in the writer’s time zone' })
  @ApiResponse({ status: 200, description: 'The day’s events', type: CalendarDayResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid day or time zone' })
  async events(@CurrentUser() user: AuthenticatedUser, @Query() query: CalendarEventsQueryDto): Promise<CalendarDayResponseDto> {
    return this.calendarService.eventsOn(user.userId, query.date, query.timeZone);
  }

  @Post('import')
  @ApiOperation({
    summary: 'Import the events of a calendar file (.ics)',
    description:
      'Up to 5 MB. Events already imported (the same UID) are updated; repeating events are counted and left out.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiResponse({ status: 201, description: 'Events imported', type: CalendarImportResponseDto })
  @ApiResponse({ status: 400, description: 'Not a calendar file, or the calendar event limit would be passed' })
  @ApiResponse({ status: 413, description: 'The file is over 5 MB' })
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { ...MULTIPART_FIELD_LIMITS, fileSize: CALENDAR_FILE_MAX_SIZE } }),
  )
  async import(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CalendarImportQueryDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<CalendarImportResponseDto> {
    return this.calendarService.import(user.userId, file, query.timeZone);
  }

  @Delete()
  @ApiOperation({ summary: 'Remove every imported calendar event' })
  @ApiResponse({ status: 200, description: 'Imported events removed', type: SuccessResponseDto })
  async clear(@CurrentUser() user: AuthenticatedUser): Promise<SuccessResponseDto> {
    return this.calendarService.clear(user.userId);
  }
}
