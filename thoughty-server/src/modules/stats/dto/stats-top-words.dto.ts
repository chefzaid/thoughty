import { ApiProperty } from '@nestjs/swagger';

export class StatsTopWordDto {
  @ApiProperty({ example: 'jardin', description: 'The word in lower case, with its accents' })
  word!: string;

  @ApiProperty({ example: 6, minimum: 2, description: 'How many times the word is used in this month’s entries' })
  count!: number;
}

/**
 * **Words you use most**: the words of this month's entries, in the writer's month (`today`), without
 * common English and French words, Markdown, links, addresses, @mentions and numbers.
 */
export class StatsTopWordsDto {
  @ApiProperty({ example: '2026-11', pattern: '^\\d{4}-\\d{2}$', description: 'The writer’s month (`YYYY-MM`), from `today`' })
  month!: string;

  @ApiProperty({
    type: [StatsTopWordDto],
    description: 'Up to ten words used at least twice in entry texts dated from the first of the month to today; most used first, then in alphabetical order',
  })
  words!: StatsTopWordDto[];
}
