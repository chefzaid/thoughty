import { ApiProperty } from '@nestjs/swagger';

export class StatsResponseDto {
  @ApiProperty({ example: 120 })
  totalThoughts!: number;

  @ApiProperty({ example: 18 })
  uniqueTagsCount!: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { '2024': 48, '2025': 72 },
  })
  thoughtsPerYear!: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { '2025-01': 12, '2025-02': 18 },
  })
  thoughtsPerMonth!: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { '2025-02-10': 1, '2025-02-11': 3 },
  })
  thoughtsPerDay!: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { work: 22, health: 9 },
  })
  thoughtsPerTag!: Record<string, number>;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      additionalProperties: { type: 'number' },
    },
    example: { '2025': { work: 10, health: 4 } },
  })
  tagsPerYear!: Record<string, Record<string, number>>;

  @ApiProperty({
    type: 'object',
    additionalProperties: {
      type: 'object',
      additionalProperties: { type: 'number' },
    },
    example: { '2025-02': { work: 6, health: 2 } },
  })
  tagsPerMonth!: Record<string, Record<string, number>>;
}