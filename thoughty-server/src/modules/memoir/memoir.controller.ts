import { Body, Controller, Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '@/common';
import { RequireFeature } from '@/common/feature-flags';
import {
  AnswerMemoirPhotoDto,
  AnswerMemoirQuestionDto,
  MemoirAnswerResultDto,
  MemoirFollowUpsDto,
  MemoirFollowUpsResponseDto,
  MemoirLeftDto,
  MemoirOverviewDto,
  MemoirPhotoAnswerResultDto,
  StartMemoirDto,
  UpdateMemoirDto,
} from './dto';
import { MemoirAnswersService } from './memoir-answers.service';
import { MemoirFollowUpsService } from './memoir-follow-ups.service';
import { MemoirPhotoAnswersService } from './memoir-photo-answers.service';
import { MemoirService } from './memoir.service';

@ApiTags('Memoir')
@ApiBearerAuth()
@Controller('memoir')
export class MemoirController {
  constructor(
    private readonly memoirService: MemoirService,
    private readonly memoirAnswersService: MemoirAnswersService,
    private readonly memoirPhotoAnswersService: MemoirPhotoAnswersService,
    private readonly memoirFollowUpsService: MemoirFollowUpsService,
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
  @ApiOperation({
    summary: "Skip: replace this week's question with the next one in the queue",
    description: 'The skipped question only comes round again once every other unanswered question has had its week.',
  })
  @ApiResponse({ status: 200, description: 'The memoir overview with the new question', type: MemoirOverviewDto })
  @ApiResponse({ status: 404, description: 'The memoir is not started' })
  skip(@CurrentUser() user: AuthenticatedUser): Promise<MemoirOverviewDto> {
    return this.memoirService.skip(user.userId);
  }

  @Post('snooze')
  @HttpCode(200)
  @ApiOperation({
    summary: "Not this week: set this week's question aside for four weeks and offer the next one",
    description:
      "The question comes back, ahead of the rest of the queue, from the writer's day of the fourth weekly delivery after now in the memoir's time zone.",
  })
  @ApiResponse({ status: 200, description: 'The memoir overview with the new question', type: MemoirOverviewDto })
  @ApiResponse({ status: 404, description: 'The memoir is not started' })
  @ApiResponse({ status: 409, description: "This week's question is already answered, or there is none" })
  snooze(@CurrentUser() user: AuthenticatedUser): Promise<MemoirOverviewDto> {
    return this.memoirService.snooze(user.userId);
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

  @Post('follow-ups')
  @RequireFeature('ai')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Interview mode: AI follow-up questions that deepen an answer being written',
    description:
      'Up to three open questions, each about a person, place, moment, object or feeling the answer names, grounded ' +
      'strictly in its words (nothing it does not say is assumed), in the language of the answer and none of `asked`. ' +
      'The question and the answer are sent to the AI provider with the prompt model; nothing is kept.',
  })
  @ApiResponse({ status: 200, description: 'The follow-up questions, empty when the answer gives nothing to build on yet', type: MemoirFollowUpsResponseDto })
  @ApiResponse({ status: 400, description: 'The answer is empty, or AI is not available (`AI_KEY_NOT_CONFIGURED`)' })
  @ApiResponse({ status: 404, description: 'Unknown question, or memoir not started' })
  @ApiResponse({ status: 502, description: 'The AI provider failed (`AI_PROVIDER_FAILED`)' })
  followUps(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MemoirFollowUpsDto,
  ): Promise<MemoirFollowUpsResponseDto> {
    return this.memoirFollowUpsService.suggest(user.userId, dto);
  }

  @Post('photo-answers')
  @ApiOperation({
    summary: 'Answer a photo prompt: an old photo and what is happening in it, as a private entry in the memoir diary',
    description:
      'The entry opens with the question, places the photo (captioned) before the story, so a book prints it next to the answer, ' +
      'and is tagged with the chosen life chapter (Photos without one) and life era.',
  })
  @ApiResponse({ status: 201, description: 'The entry holding the photo and its story', type: MemoirPhotoAnswerResultDto })
  @ApiResponse({ status: 400, description: 'The story is empty, or the attachment is not a JPEG, PNG, GIF or WebP picture' })
  @ApiResponse({ status: 404, description: 'Memoir not started, or attachment or life era not yours' })
  @ApiResponse({ status: 409, description: 'The picture is already on an entry, or the memoir has no diary' })
  answerPhoto(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AnswerMemoirPhotoDto,
  ): Promise<MemoirPhotoAnswerResultDto> {
    return this.memoirPhotoAnswersService.answer(user.userId, dto);
  }
}
