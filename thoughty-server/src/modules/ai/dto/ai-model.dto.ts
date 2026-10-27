import { ApiProperty } from '@nestjs/swagger';

/** An OpenRouter model the user can pick for an AI task. */
export class AiModelDto {
  @ApiProperty({ description: 'OpenRouter model id', example: 'openai/gpt-4o-mini' })
  id!: string;

  @ApiProperty({ description: 'Display name', example: 'OpenAI: GPT-4o-mini' })
  name!: string;
}
