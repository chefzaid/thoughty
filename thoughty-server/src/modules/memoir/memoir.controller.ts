import { Body, Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '@/common';
import {
  AnswerMemoirQuestionDto,
  MemoirAnswerResultDto,
  MemoirLeftDto,
  MemoirOverviewDto,
  StartMemoirDto,
  UpdateMemoirDto,
} from './dto';
import { MemoirAnswersService } from './memoir-answers.service';
import { MemoirService } from './memoir.service';

@ApiTags('Memoir')
@ApiBearerAuth()
@Controller('memoir')
export class MemoirController {
  constructor(
    private readonly memoirService: MemoirService,
    private readonly memoirAnswersService: MemoirAnswersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get the guided memoir: program settings, questions by chapter, and progress' })
  @ApiResponse({ status: 200, description: 'The memoir overview', type: MemoirOverviewDto })
  getOverview(@CurrentUser() user: AuthenticatedUser): Promise<MemoirOverviewDto> {
    return this.memoirService.getOverview(user.userId);
  }

  @Post()
  @ApiOperation({ summary: 'Start the guided memoir in a new or existing diary' })
  @ApiResponse({ status: 201, description: 'The memoir overview with the first question', type: MemoirOverviewDto })
  @ApiResponse({ status: 404, description: 'The chosen diary does not belong to you' })
  @ApiResponse({ status: 409, description: 'The memoir is already started' })
  start(@CurrentUser() user: AuthenticatedUser, @Body() dto: StartMemoirDto): Promise<MemoirOverviewDto> {
    return this.memoirService.start(user.userId, dto);
  }

  @Patch()
  @ApiOperation({ summary: 'Change memoir settings, or pause and resume weekly questions' })
  @ApiResponse({ status: 200, description: 'The updated memoir overview', type: MemoirOverviewDto })
  @ApiResponse({ status: 404, description: 'The memoir is not started or the diary does not belong to you' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateMemoirDto): Promise<MemoirOverviewDto> {
    return this.memoirService.update(user.userId, dto);
  }

  @Delete()
  @ApiOperation({ summary: 'Stop the guided memoir; answers stay in the journal' })
  @ApiResponse({ status: 200, description: 'The memoir program was removed', type: MemoirLeftDto })
  leave(@CurrentUser() user: AuthenticatedUser): Promise<MemoirLeftDto> {
    return this.memoirService.leave(user.userId);
  }

  @Post('skip')
  @HttpCode(200)
  @ApiOperation({ summary: "Replace this week's question with the next unanswered one" })
  @ApiResponse({ status: 200, description: 'The memoir overview with the new question', type: MemoirOverviewDto })
  @ApiResponse({ status: 404, description: 'The memoir is not started' })
  skip(@CurrentUser() user: AuthenticatedUser): Promise<MemoirOverviewDto> {
    return this.memoirService.skip(user.userId);
  }

  @Post('answers')
  @ApiOperation({ summary: 'Answer a memoir question as a private entry in the memoir diary' })
  @ApiResponse({ status: 201, description: 'The entry holding the answer', type: MemoirAnswerResultDto })
  @ApiResponse({ status: 400, description: 'The answer is empty and has no recording' })
  @ApiResponse({ status: 404, description: 'Unknown question, memoir not started, or attachment not yours' })
  @ApiResponse({ status: 409, description: 'The question already has an answer, or the memoir has no diary' })
  answer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AnswerMemoirQuestionDto,
  ): Promise<MemoirAnswerResultDto> {
    return this.memoirAnswersService.answer(user.userId, dto);
  }
}
