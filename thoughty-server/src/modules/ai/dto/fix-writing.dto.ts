import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class FixWritingDto {
  @ApiProperty({ description: 'Entry content to fix for grammar, spelling, and style' })
  @IsString()
  @MaxLength(10000)
  content!: string;
}
