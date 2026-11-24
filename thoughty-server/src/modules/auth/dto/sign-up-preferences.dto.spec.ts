import { BadRequestException } from '@nestjs/common';
import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { OAuthDto, RegisterDto } from './auth.dto';
import { SignUpPreferencesDto } from './sign-up-preferences.dto';

const REGISTER = { email: 'writer@example.com', password: 'Password123!', username: 'writer', website: '' };

describe('SignUpPreferencesDto', () => {
  it('takes each language and theme the app offers, and neither', async () => {
    for (const language of ['en', 'fr']) {
      for (const theme of ['light', 'dark']) {
        await expect(invalidPropertiesLikeApi(SignUpPreferencesDto, { language, theme })).resolves.toEqual([]);
      }
    }
    await expect(invalidPropertiesLikeApi(SignUpPreferencesDto, {})).resolves.toEqual([]);
  });

  it.each([
    [{ language: 'de' }, ['language']],
    [{ language: 'FR' }, ['language']],
    [{ language: ['fr', 'en'] }, ['language']],
    [{ theme: 'sepia' }, ['theme']],
    [{ theme: true }, ['theme']],
    [{ language: '', theme: '' }, ['language', 'theme']],
  ])('refuses %j', async (plain, invalid) => {
    await expect(invalidPropertiesLikeApi(SignUpPreferencesDto, plain)).resolves.toEqual(invalid);
  });

  it('reads them from a query string, as the Keycloak exchange sends them', async () => {
    await expect(parseLikeApi(SignUpPreferencesDto, { language: 'fr', theme: 'light' }, 'query')).resolves.toEqual({
      language: 'fr',
      theme: 'light',
    });
    await expect(parseLikeApi(SignUpPreferencesDto, { lang: 'fr' }, 'query')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('comes with registration and Google sign-in', async () => {
    await expect(invalidPropertiesLikeApi(RegisterDto, { ...REGISTER, language: 'fr', theme: 'light' })).resolves.toEqual([]);
    await expect(invalidPropertiesLikeApi(RegisterDto, { ...REGISTER, theme: 'blue' })).resolves.toEqual(['theme']);
    await expect(
      invalidPropertiesLikeApi(OAuthDto, { provider: 'google', credential: 'token', language: 'es' }),
    ).resolves.toEqual(['language']);
  });
});
