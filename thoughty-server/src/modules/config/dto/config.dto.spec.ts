import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { getMetadataStorage } from 'class-validator';
import { UpdateConfigDto, USER_CONFIG_KEYS } from './config.dto';

describe('UpdateConfigDto', () => {
  // Same options as the global pipe in main.ts
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  });
  const validate = (body: Record<string, unknown>) =>
    pipe.transform(body, { type: 'body', metatype: UpdateConfigDto });

  it('lists exactly the keys the DTO validates', () => {
    const validated = new Set(
      getMetadataStorage()
        .getTargetValidationMetadatas(UpdateConfigDto, '', true, false)
        .map((metadata) => metadata.propertyName),
    );
    expect([...validated].sort()).toEqual([...USER_CONFIG_KEYS].sort());
  });

  it('accepts the configuration the web sends, storing numbers and booleans as text', async () => {
    const result = await validate({
      theme: 'light',
      name: 'Jane',
      bio: '',
      email: 'jane@example.com',
      birthday: '1990-04-02',
      gender: '',
      avatarUrl: 'data:image/jpeg;base64,/9j/4AAQ==',
      fontFamily: 'serif',
      fontSize: 18,
      fontColor: '#112233',
      highContrast: true,
      ttsVoiceUri: '',
      language: 'fr',
      entriesPerPage: '25',
      maxPinnedEntries: 3,
      defaultVisibility: 'public',
      readDates: false,
      openRouterModel: 'anthropic/claude-sonnet-4:beta',
      openRouterTagModel: '',
      openRouterWritingModel: '',
      openRouterChatModel: '',
      openRouterToneModel: '',
      openRouterSummaryModel: '',
      openRouterPromptModel: '',
      openRouterBookModel: '',
      autoTagMaxTags: '0',
      tagMetadata: '{}',
      entryTemplates: '[]',
      subscriptionPlan: 'pro',
      paymentMethodLabel: 'Visa ending 1111',
    });

    expect(result).toMatchObject({
      fontSize: '18',
      highContrast: 'true',
      maxPinnedEntries: '3',
      readDates: 'false',
    });
  });

  it('accepts an http(s) avatar and an empty one', async () => {
    await expect(validate({ avatarUrl: 'https://lh3.googleusercontent.com/a/x' })).resolves.toBeDefined();
    await expect(validate({ avatarUrl: '' })).resolves.toBeDefined();
  });

  it.each([
    'openRouterApiKey',
    'cloud_google_drive_access_token',
    'cloud_dropbox_refresh_token',
    'cloud_onedrive_sync_enabled',
    'cloud_google_drive_last_sync_hash',
    'io_dateFormat',
    'somethingElse',
  ])('rejects the reserved or unknown key %s', async (key) => {
    await expect(validate({ theme: 'dark', [key]: 'x' })).rejects.toThrow(BadRequestException);
  });

  it.each([
    ['theme', 'purple'],
    ['language', 'es'],
    ['defaultVisibility', 'friends'],
    ['subscriptionPlan', 'enterprise'],
    ['highContrast', 'yes'],
    ['fontColor', 'red'],
    ['fontSize', '1e9'],
    ['birthday', 'tomorrow'],
    ['avatarUrl', 'javascript:alert(1)'],
    ['name', 'x'.repeat(201)],
    ['tagMetadata', { work: { color: '#fff' } }],
    ['entryTemplates', ['a']],
  ])('rejects an invalid %s', async (key, value) => {
    await expect(validate({ [key]: value })).rejects.toThrow(BadRequestException);
  });
});
