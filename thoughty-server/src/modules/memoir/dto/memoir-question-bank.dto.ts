import { ApiProperty } from '@nestjs/swagger';
import { LocalizedTextDto } from './memoir.dto';

export class MemoirBankQuestionDto {
  @ApiProperty({ example: 'childhood-home' })
  id!: string;

  @ApiProperty({ type: LocalizedTextDto })
  text!: LocalizedTextDto;
}

export class MemoirBankChapterDto {
  @ApiProperty({ example: 'childhood' })
  id!: string;

  @ApiProperty({ type: LocalizedTextDto })
  title!: LocalizedTextDto;

  @ApiProperty({ example: false, description: 'A themed chapter a writer adds by choice; the others make up the year of weekly questions' })
  theme!: boolean;

  @ApiProperty({ type: [MemoirBankQuestionDto] })
  questions!: MemoirBankQuestionDto[];
}

export class MemoirQuestionBankDto {
  @ApiProperty({ type: [MemoirBankChapterDto], description: 'Every chapter of the guided memoir in life order, the themed ones included' })
  chapters!: MemoirBankChapterDto[];
}
