import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import {
  APP_LANGUAGES,
  APP_THEMES,
  type AppLanguage,
  type AppTheme,
} from '@/modules/config/dto/config.dto';

/**
 * The language and theme a visitor read the pages in when signing up. A new account starts with them
 * as its `language` and `theme` settings, and the sign-up emails are written in that language; either
 * left out keeps the account default (English, dark). An account that already exists keeps its own.
 */
export class SignUpPreferencesDto {
  @ApiPropertyOptional({
    enum: APP_LANGUAGES,
    description:
      'The language the visitor reads the pages in: a new account starts in it, and the sign-up email is written in it',
  })
  @IsOptional()
  @IsIn(APP_LANGUAGES)
  language?: AppLanguage;

  @ApiPropertyOptional({ enum: APP_THEMES, description: 'The color theme the visitor sees: a new account starts in it' })
  @IsOptional()
  @IsIn(APP_THEMES)
  theme?: AppTheme;
}

/** The preferences a new account starts with, as given at sign-up. */
export type SignUpPreferences = Pick<SignUpPreferencesDto, 'language' | 'theme'>;
