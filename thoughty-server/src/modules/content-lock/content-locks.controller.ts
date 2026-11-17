import { Body, Controller, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '@/common/decorators';
import { EntryMutationResponseDto } from '@/modules/entries/dto';
import { toEntryResponse } from '@/modules/entries/entry-response.mapper';
import { DiaryResponseDto } from '@/modules/diaries/dto';
import { ContentLocksService } from './content-locks.service';
import { SetLockDto } from './dto';

const LOCK_DESCRIPTION =
  'Locking hides it behind the writer’s PIN on this account (an access gate, not encryption) and makes it ' +
  'private: its public entries leave the feed and its share links stop opening until the lock is lifted. ' +
  'Lifting the lock needs an unlocked request.';

@ApiTags('PIN lock')
@ApiBearerAuth()
@Controller('entries')
export class EntryLockController {
  constructor(private readonly locks: ContentLocksService) {}

  @Patch(':id/lock')
  @ApiOperation({ summary: 'Lock or unlock an entry', description: LOCK_DESCRIPTION })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'The entry, withheld while the request is not unlocked', type: EntryMutationResponseDto })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  @ApiResponse({ status: 409, description: 'No PIN is set yet (`CONTENT_PIN_NOT_SET`)' })
  @ApiResponse({ status: 423, description: 'Lifting the lock needs an unlocked request' })
  async setLocked(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetLockDto,
  ): Promise<EntryMutationResponseDto> {
    const entry = await this.locks.setEntryLocked(user.userId, id, dto.locked);
    return { success: true, entry: toEntryResponse(entry) };
  }
}

@ApiTags('PIN lock')
@ApiBearerAuth()
@Controller('diaries')
export class DiaryLockController {
  constructor(private readonly locks: ContentLocksService) {}

  @Patch(':id/lock')
  @ApiOperation({ summary: 'Lock or unlock a diary and every entry in it', description: LOCK_DESCRIPTION })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'The diary', type: DiaryResponseDto })
  @ApiResponse({ status: 404, description: 'Diary not found' })
  @ApiResponse({ status: 409, description: 'No PIN is set yet (`CONTENT_PIN_NOT_SET`)' })
  @ApiResponse({ status: 423, description: 'Lifting the lock needs an unlocked request' })
  async setLocked(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetLockDto,
  ): Promise<DiaryResponseDto> {
    return this.locks.setDiaryLocked(user.userId, id, dto.locked);
  }
}
