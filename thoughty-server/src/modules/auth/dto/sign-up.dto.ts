import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * What registration answers when the server can send email: the same body for every address, so
 * it never tells whether one already has an account. A new address gets a link that creates the
 * account; one that has an account gets a notice to sign in or reset the password instead.
 */
export class SignUpStartedResponseDto {
  @ApiProperty({ example: true })
  verificationRequired: true;

  @ApiProperty({ example: 'Check your email to finish creating your account.' })
  message: string;
}

export class CompleteSignUpDto {
  @ApiProperty({ description: 'The single-use token from the emailed sign-up link' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  token: string;

  @ApiProperty({ description: 'The password chosen on the sign-up form, entered again' })
  @IsString()
  @MinLength(1)
  password: string;

  @ApiPropertyOptional({
    example: 'johndoe',
    description:
      'Replaces the username asked for on the sign-up form, for when that one is already taken',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username can only contain letters, numbers, underscores, and hyphens',
  })
  username?: string;
}
