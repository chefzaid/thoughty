import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '@/common';
import { GetPublicFeedQueryDto, PublicFeedResponseDto } from './dto';
import { PublicFeedService } from './public-feed.service';

/**
 * Serves the feed under the entries prefix it has always used. The entries controller has
 * no single-segment `GET :id` route, so `entries/feed` never collides with it.
 */
@ApiTags('Social')
@ApiBearerAuth()
@Controller('entries/feed')
export class FeedController {
  constructor(private readonly publicFeedService: PublicFeedService) {}

  @Get()
  @ApiOperation({ summary: 'Get moderation-visible public entries for the social feed' })
  @ApiResponse({ status: 200, description: 'Paginated public feed', type: PublicFeedResponseDto })
  getFeed(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: GetPublicFeedQueryDto,
  ): Promise<PublicFeedResponseDto> {
    return this.publicFeedService.getFeed(user.userId, query);
  }
}
