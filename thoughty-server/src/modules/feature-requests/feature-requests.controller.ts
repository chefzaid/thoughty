import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser, Public } from '@/common';
import {
  CreateFeatureRequestDto,
  FeatureRequestDto,
  FeatureRequestListResponseDto,
  FeatureRequestVoteResponseDto,
  FeatureRequestVotesResponseDto,
} from './dto';
import { FeatureRequestsService } from './feature-requests.service';

@ApiTags('Feature Requests')
@ApiBearerAuth()
@Controller('feature-requests')
export class FeatureRequestsController {
  constructor(private readonly featureRequestsService: FeatureRequestsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'List the highest-voted feature requests' })
  @ApiResponse({
    status: 200,
    description: 'Ranked public feature-request board',
    type: FeatureRequestListResponseDto,
  })
  async list(): Promise<FeatureRequestListResponseDto> {
    return { requests: await this.featureRequestsService.list() };
  }

  @Get('votes')
  @ApiOperation({ summary: 'List feature requests voted for by the current user' })
  @ApiResponse({
    status: 200,
    description: 'Feature-request identifiers voted for by the authenticated user',
    type: FeatureRequestVotesResponseDto,
  })
  async getVotes(@CurrentUser() user: AuthenticatedUser): Promise<FeatureRequestVotesResponseDto> {
    return { requestIds: await this.featureRequestsService.getVotedRequestIds(user.userId) };
  }

  @Post()
  @ApiOperation({ summary: 'Submit a feature request and vote for it' })
  @ApiResponse({
    status: 201,
    description: 'Newly persisted feature request with its first vote',
    type: FeatureRequestDto,
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateFeatureRequestDto,
  ): Promise<FeatureRequestDto> {
    return this.featureRequestsService.create(user.userId, dto);
  }

  @Post(':id/vote')
  @ApiOperation({ summary: 'Vote once for a feature request' })
  @ApiResponse({
    status: 201,
    description: 'Authoritative vote state and count for the feature request',
    type: FeatureRequestVoteResponseDto,
  })
  vote(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<FeatureRequestVoteResponseDto> {
    return this.featureRequestsService.vote(user.userId, id);
  }
}
