import {
  IsOptional,
  IsNumber,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class LinkAttachmentDto {
  @ApiPropertyOptional({ description: 'Entry ID to link attachment to' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  entryId?: number;
}
