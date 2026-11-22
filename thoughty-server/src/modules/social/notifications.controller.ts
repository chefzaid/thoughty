import { Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthenticatedUser, CurrentUser, RATE_LIMITS, throttleDefault } from '@/common';
import { RequireFeature } from '@/common/feature-flags';
import { NotificationsResponseDto, UnreadNotificationsDto } from './dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Social')
@ApiBearerAuth()
@RequireFeature('publicSharing')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'List the comments and likes on your public entries, the likes on your comments, and new followers',
  })
  @ApiResponse({
    status: 200,
    description: 'The most recent notifications, newest first, and how many are new',
    type: NotificationsResponseDto,
  })
  list(@CurrentUser() user: AuthenticatedUser): Promise<NotificationsResponseDto> {
    return this.notificationsService.list(user.userId);
  }

  @Get('unread')
  @ApiOperation({ summary: 'Count the notifications that came after they were last opened' })
  @ApiResponse({ status: 200, description: 'How many notifications are new', type: UnreadNotificationsDto })
  async countUnread(@CurrentUser() user: AuthenticatedUser): Promise<UnreadNotificationsDto> {
    return { unreadCount: await this.notificationsService.countUnread(user.userId) };
  }

  @Put('read')
  @Throttle(throttleDefault(RATE_LIMITS.socialWrite))
  @ApiOperation({ summary: 'Mark every notification until now as read' })
  @ApiResponse({ status: 200, description: 'No notification is new any more', type: UnreadNotificationsDto })
  async markRead(@CurrentUser() user: AuthenticatedUser): Promise<UnreadNotificationsDto> {
    await this.notificationsService.markRead(user.userId);
    return { unreadCount: 0 };
  }
}
