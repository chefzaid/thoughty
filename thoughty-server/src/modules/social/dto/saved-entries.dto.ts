import { ApiProperty } from '@nestjs/swagger';

export class SavedStateDto {
  @ApiProperty({ example: true, description: 'Whether the entry is in the current user’s Saved list' })
  saved!: boolean;
}
