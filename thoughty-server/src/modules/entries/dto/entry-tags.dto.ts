// Renaming, removing and counting the tags used across a user's entries.
import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RenameTagDto {
  @ApiProperty({ description: 'Current tag name to rename' })
  @IsString()
  @MaxLength(50)
  oldTag: string;

  @ApiProperty({ description: 'New tag name that should replace the current tag' })
  @IsString()
  @MaxLength(50)
  newTag: string;
}

export class DeleteTagQueryDto {
  @ApiProperty({ description: 'Tag to remove from all of the current user entries' })
  @IsString()
  @MaxLength(50)
  tag: string;
}

export class TagUsageDto {
  @ApiProperty()
  tag: string;

  @ApiProperty({ description: 'Number of entries using the tag' })
  count: number;
}

export class TagUsageListResponseDto {
  @ApiProperty({ type: [TagUsageDto] })
  tags: TagUsageDto[];
}
