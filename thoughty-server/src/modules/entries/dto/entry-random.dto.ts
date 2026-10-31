// A random entry among the journal filters: the query and the entry it lands on.
import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsOptional, Min } from 'class-validator';
import { StrictInt } from '@/common/validation';
import { GetEntriesQueryDto } from './entry-query.dto';

/** The journal list's query without its page, and the entry not to land on again. */
export class GetRandomEntryQueryDto extends OmitType(GetEntriesQueryDto, ['page'] as const) {
  @ApiPropertyOptional({
    description:
      'The entry picked last time: another one is picked when the filters match any other, so asking again moves on',
    example: 42,
  })
  @IsOptional()
  @StrictInt()
  @Min(1)
  excludeId?: number;
}

export class RandomEntryResponseDto {
  @ApiProperty({ example: 42 })
  id: number;

  @ApiProperty({ description: 'Entry date (YYYY-MM-DD)', example: '2024-03-10' })
  date: string;

  @ApiProperty({ description: 'Same-day index, as cross-references use it', example: 1 })
  index: number;

  @ApiProperty({
    description: 'The page of the filtered journal list, at the requested page size and order, that shows the entry',
    example: 3,
  })
  page: number;
}
