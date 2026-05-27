import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class ChatMessageDto {
  @ApiProperty({ description: 'Role of the message sender', enum: ['user', 'assistant'] })
  @IsString()
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ description: 'Message content' })
  @IsString()
  @MaxLength(10000)
  content!: string;
}

export class ChatDto {
  @ApiProperty({ description: 'The entry being discussed' })
  @IsInt()
  @Min(1)
  entryId!: number;

  @ApiProperty({ description: 'The journal entry content to discuss' })
  @IsString()
  @MaxLength(10000)
  entryContent!: string;

  @ApiProperty({ description: 'Conversation messages', type: [ChatMessageDto] })
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}

export class ChatHistoryResponseDto {
  @ApiProperty({ description: 'The entry being discussed' })
  entryId!: number;

  @ApiProperty({ description: 'Conversation messages', type: [ChatMessageDto] })
  messages!: ChatMessageDto[];
}

export class ChatResponseDto {
  @ApiProperty({ description: 'Assistant reply' })
  reply!: string;
}
