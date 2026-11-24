import { Controller, Delete, Param, ParseIntPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser, CurrentUser, RATE_LIMITS, throttleDefault } from '@/common';
import { RequireFeature } from '@/common/feature-flags';
import { SavedStateDto } from './dto';
import { SavedEntriesService } from './saved-entries.service';

@ApiTags('Social')
@ApiBearerAuth()
@RequireFeature('publicSharing')
@Controller('entries/:entryId/save')
export class SavedEntriesController {
  constructor(private readonly savedEntriesService: SavedEntriesService) {}

  @Put()
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({
    summary: 'Save a public entry written by someone else to your private Saved list',
  })
  @ApiResponse({ status: 200, description: 'The entry is saved', type: SavedStateDto })
  @ApiResponse({ status: 400, description: 'Users cannot save their own entries' })
  @ApiResponse({ status: 404, description: 'The entry is not visible in the public feed' })
  @ApiResponse({ status: 403, description: 'Only the followers its writer approved can read this entry (`FOLLOW_APPROVAL_REQUIRED`)' })
  saveEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
  ): Promise<SavedStateDto> {
    return this.savedEntriesService.setSaved(user.userId, entryId, true);
  }

  @Delete()
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Remove a public entry from your Saved list' })
  @ApiResponse({ status: 200, description: 'The entry is no longer saved', type: SavedStateDto })
  @ApiResponse({ status: 404, description: 'The entry is not visible in the public feed' })
  unsaveEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Param('entryId', ParseIntPipe) entryId: number,
  ): Promise<SavedStateDto> {
    return this.savedEntriesService.setSaved(user.userId, entryId, false);
  }
}
