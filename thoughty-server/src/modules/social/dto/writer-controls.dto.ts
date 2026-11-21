import { ApiProperty } from '@nestjs/swagger';

export class HiddenWriterDto {
  @ApiProperty({ example: 2 })
  id!: number;

  @ApiProperty({ example: 'maya' })
  username!: string;

  @ApiProperty({ type: String, nullable: true, example: null })
  avatarUrl!: string | null;

  @ApiProperty({
    example: '2026-09-01T08:30:00.000Z',
    description: 'When the writer was muted or blocked',
  })
  since!: string;
}

export class HiddenWritersResponseDto {
  @ApiProperty({
    type: [HiddenWriterDto],
    description:
      'Writers whose entries and comments the current user keeps out of their feed, by name',
  })
  muted!: HiddenWriterDto[];

  @ApiProperty({
    type: [HiddenWriterDto],
    description: 'Writers the current user blocked, by name',
  })
  blocked!: HiddenWriterDto[];
}

export class WriterMuteStateDto {
  @ApiProperty({ example: 2 })
  userId!: number;

  @ApiProperty({ example: true })
  muted!: boolean;
}

export class WriterBlockStateDto {
  @ApiProperty({ example: 2 })
  userId!: number;

  @ApiProperty({ example: true })
  blocked!: boolean;
}
