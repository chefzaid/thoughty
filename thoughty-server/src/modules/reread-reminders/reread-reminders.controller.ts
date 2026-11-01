import { Body, Controller, Delete, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { JwtAuthGuard } from '@/modules/auth/guards';
import { EntryMutationResponseDto } from '@/modules/entries/dto';
import { toEntryResponse } from '@/modules/entries/entry-response.mapper';
import { SetRereadReminderDto } from './dto';
import { RereadReminderService } from './reread-reminders.service';

@ApiTags('Entries')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('entries')
export class RereadRemindersController {
  constructor(private readonly reminders: RereadReminderService) {}

  @Put(':id/reread-reminder')
  @ApiOperation({
    summary: 'Ask to reread an entry on a day',
    description:
      'Sets the entry’s reread reminder, or replaces the one it has: from that day (on the writer’s clock) ' +
      'Highlights shows the entry with "You asked to reread this" until it is marked done.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Reminder set', type: EntryMutationResponseDto })
  @ApiResponse({ status: 400, description: 'The day is not from tomorrow up to 50 years ahead, or `today` is not the writer’s day' })
  @ApiResponse({ status: 404, description: 'Entry not found, or in the recycle bin' })
  @ApiResponse({ status: 409, description: 'The entry is a sealed time capsule' })
  async set(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetRereadReminderDto,
  ): Promise<EntryMutationResponseDto> {
    const entry = await this.reminders.set(user.userId, id, dto.rereadOn, dto.today);
    return { success: true, entry: toEntryResponse(entry) };
  }

  @Delete(':id/reread-reminder')
  @ApiOperation({
    summary: 'Remove an entry’s reread reminder, or mark it done',
    description: 'Highlights stops showing the entry. An entry without a reminder is left as it is.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Reminder removed', type: EntryMutationResponseDto })
  @ApiResponse({ status: 404, description: 'Entry not found, or in the recycle bin' })
  @ApiResponse({ status: 409, description: 'The entry is a sealed time capsule' })
  async clear(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<EntryMutationResponseDto> {
    const entry = await this.reminders.clear(user.userId, id);
    return { success: true, entry: toEntryResponse(entry) };
  }
}
