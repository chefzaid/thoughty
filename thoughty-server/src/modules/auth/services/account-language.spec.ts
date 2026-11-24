import { findAccountLanguage } from './account-language';

describe('findAccountLanguage', () => {
  it('reads the account’s language setting, and nothing when it was never chosen', async () => {
    const settings = { findOne: jest.fn().mockResolvedValueOnce({ value: 'fr' }).mockResolvedValueOnce(null) };

    await expect(findAccountLanguage(settings as never, 7)).resolves.toBe('fr');
    await expect(findAccountLanguage(settings as never, 8)).resolves.toBeUndefined();
    expect(settings.findOne).toHaveBeenCalledWith({ where: { userId: 7, key: 'language' }, select: { value: true } });
  });
});
