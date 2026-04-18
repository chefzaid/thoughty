import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ChatMessageDto {
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
