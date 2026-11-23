import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const CONTACT_NAME_MAX_LENGTH = 100;
export const CONTACT_EMAIL_MAX_LENGTH = 254;
export const CONTACT_MESSAGE_MIN_LENGTH = 10;
export const CONTACT_MESSAGE_MAX_LENGTH = 5000;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** A message from the public Contact page, emailed as plain text to the deployment's `CONTACT_EMAIL`. */
export class ContactMessageDto {
  @ApiProperty({ example: 'Camille', minLength: 1, maxLength: CONTACT_NAME_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @Length(1, CONTACT_NAME_MAX_LENGTH)
  // The name goes into the subject line: no line breaks or other control characters
  @Matches(/^[^\p{Cc}]+$/u)
  name!: string;

  @ApiProperty({ example: 'camille@example.com', maxLength: CONTACT_EMAIL_MAX_LENGTH, description: 'Where the reply goes' })
  @Transform(trim)
  @IsString()
  @MaxLength(CONTACT_EMAIL_MAX_LENGTH)
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'How do I move my entries from Day One?',
    minLength: CONTACT_MESSAGE_MIN_LENGTH,
    maxLength: CONTACT_MESSAGE_MAX_LENGTH,
  })
  @Transform(trim)
  @IsString()
  @Length(CONTACT_MESSAGE_MIN_LENGTH, CONTACT_MESSAGE_MAX_LENGTH)
  message!: string;

  @ApiPropertyOptional({ description: 'Hidden bot-trap field; must be left empty by real users' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  website?: string;
}
