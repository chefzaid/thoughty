import { Controller, Get, Header } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common';
import { MemoirQuestionBankDto } from './dto';
import { MEMOIR_CHAPTERS } from './memoir-questions';

/** The questions are the same for everyone, so the public pages can show them without an account. */
const QUESTION_BANK: MemoirQuestionBankDto = {
  chapters: MEMOIR_CHAPTERS.map((chapter) => ({
    id: chapter.id,
    title: { ...chapter.title },
    theme: chapter.theme,
    questions: chapter.questions.map((question) => ({ id: question.id, text: { ...question.text } })),
  })),
};

@ApiTags('Memoir')
@Controller('memoir/questions')
export class MemoirQuestionsController {
  @Public()
  @Get()
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({
    summary: 'List the guided memoir questions by chapter, without an account',
    description: 'The public question pages read it; it holds no writer data, only the questions every memoir asks.',
  })
  @ApiResponse({ status: 200, description: 'Every chapter and its questions, in life order', type: MemoirQuestionBankDto })
  list(): MemoirQuestionBankDto {
    return QUESTION_BANK;
  }
}
