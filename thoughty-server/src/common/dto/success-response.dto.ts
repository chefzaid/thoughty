import { ApiProperty } from '@nestjs/swagger';

/** What an action that returns no data answers once it is done. */
export class SuccessResponseDto {
  @ApiProperty()
  success: boolean;
}

/** An action's outcome with a sentence for the user, such as the password and email verification steps. */
export class SuccessMessageResponseDto extends SuccessResponseDto {
  @ApiProperty({ description: 'What happened, in English' })
  message: string;
}
