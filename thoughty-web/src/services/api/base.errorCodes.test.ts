import { describe, expect, it } from 'vitest';
import { getTranslation } from '../../utils/translations';
import { readApiErrorMessage } from './base';

const apiError = (body: object, status = 400) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('readApiErrorMessage with error codes', () => {
  it('gives the translation key of a known code', async () => {
    const response = apiError(
      { statusCode: 401, message: 'Invalid or expired verification code.', error: 'Unauthorized', code: 'AUTH_INVALID_2FA_CODE' },
      401,
    );

    await expect(readApiErrorMessage(response, 'twoFactorVerificationFailed')).resolves.toBe('apiError_AUTH_INVALID_2FA_CODE');
  });

  it('shows the server message for a code the app does not know yet', async () => {
    const response = apiError({ statusCode: 400, message: 'A brand new failure', code: 'SOMETHING_NEW' });

    await expect(readApiErrorMessage(response, 'Fallback')).resolves.toBe('A brand new failure');
  });

  it.each([
    ['a non-string code', { message: 'Kept message', code: 42 }],
    ['an inherited property name', { message: 'Kept message', code: 'constructor' }],
  ])('ignores %s', async (_shape, body) => {
    await expect(readApiErrorMessage(apiError(body), 'Fallback')).resolves.toBe('Kept message');
  });

  it('falls back to the caller key when an unknown code comes without a message', async () => {
    await expect(readApiErrorMessage(apiError({ code: 'SOMETHING_NEW' }), 'diaryCreateFailed')).resolves.toBe('diaryCreateFailed');
  });

  it.each([
    ['AUTH_INVALID_2FA_CODE', 'Invalid or expired verification code.', 'Code de vérification invalide ou expiré.'],
    ['AUTH_INVALID_CREDENTIALS', 'Invalid email or password', 'E-mail ou mot de passe invalide.'],
    ['AUTH_CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect', 'Votre mot de passe actuel est incorrect.'],
    ['DIARY_NAME_TAKEN', 'A diary with this name already exists', 'Un journal portant ce nom existe déjà.'],
    ['ENTRY_PIN_LIMIT_REACHED', 'Pinned entry limit reached (3)', 'Vous avez atteint la limite d’entrées épinglées. Désépinglez-en une d’abord.'],
    ['AI_KEY_REJECTED', 'OpenRouter rejected this API key', 'OpenRouter a refusé cette clé API.'],
    ['VALIDATION_FAILED', 'password must be longer than or equal to 8 characters', 'Certaines informations envoyées sont manquantes ou invalides.'],
  ])('shows %s in French instead of the English server message', async (code, message, french) => {
    const key = await readApiErrorMessage(apiError({ statusCode: 400, message, error: 'Bad Request', code }), 'Fallback');

    expect(getTranslation('fr', key)).toBe(french);
    expect(getTranslation('en', key)).not.toBe(key);
  });
});
