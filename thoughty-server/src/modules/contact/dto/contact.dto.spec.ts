import { invalidPropertiesLikeApi, parseLikeApi } from '@/common/validation/dto-validation.test-helpers';
import { ContactMessageDto } from './contact.dto';

const valid = { name: 'Camille', email: 'camille@example.com', message: 'How do I export my journal?' };

describe('ContactMessageDto', () => {
  it('trims and accepts a bounded message', async () => {
    await expect(
      parseLikeApi(ContactMessageDto, {
        name: '  Camille Dupont ',
        email: ' camille@example.com ',
        message: '\n  Bonjour, how do I export?  \n',
        website: '',
      }),
    ).resolves.toEqual({ name: 'Camille Dupont', email: 'camille@example.com', message: 'Bonjour, how do I export?', website: '' });
  });

  it('accepts a message of up to 5,000 characters on several lines', async () => {
    await expect(invalidPropertiesLikeApi(ContactMessageDto, { ...valid, message: `Line one\nLine two\n${'x'.repeat(4982)}` })).resolves.toEqual([]);
    await expect(invalidPropertiesLikeApi(ContactMessageDto, { ...valid, name: 'N'.repeat(100) })).resolves.toEqual([]);
  });

  it('refuses empty, short, oversized or malformed fields', async () => {
    await expect(
      invalidPropertiesLikeApi(ContactMessageDto, { name: '   ', email: 'not-an-address', message: 'Too short' }),
    ).resolves.toEqual(['name', 'email', 'message']);
    await expect(
      invalidPropertiesLikeApi(ContactMessageDto, {
        name: 'N'.repeat(101),
        email: `${'a'.repeat(250)}@example.com`,
        message: 'x'.repeat(5001),
        website: 'w'.repeat(101),
      }),
    ).resolves.toEqual(['name', 'email', 'message', 'website']);
    await expect(invalidPropertiesLikeApi(ContactMessageDto, { name: 12, email: 3, message: ['a'] })).resolves.toEqual([
      'name',
      'email',
      'message',
    ]);
  });

  it('refuses a name with a line break, which would reach the subject line', async () => {
    await expect(invalidPropertiesLikeApi(ContactMessageDto, { ...valid, name: 'Camille\r\nBcc: x@example.com' })).resolves.toEqual(['name']);
    await expect(invalidPropertiesLikeApi(ContactMessageDto, { ...valid, name: 'Tab\there' })).resolves.toEqual(['name']);
  });

  it('refuses unknown properties', async () => {
    await expect(invalidPropertiesLikeApi(ContactMessageDto, { ...valid, to: 'someone@example.com' })).resolves.toEqual(['to']);
  });
});
