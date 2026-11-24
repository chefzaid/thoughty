import { canReceiveEmail, isPlaceholderEmail, placeholderEmail } from './placeholder-email.util';

describe('placeholder addresses', () => {
  it('builds the placeholder of an account from its id, on the reserved .invalid domain', () => {
    expect(placeholderEmail(42)).toBe('user-42@invalid');
    expect(isPlaceholderEmail(placeholderEmail(42))).toBe(true);
  });

  it.each(['user-7@invalid', 'USER-7@INVALID', 'writer@mail.invalid', ' a@b.Invalid ', '', '   ', 'no-at-sign', null, undefined])(
    'counts %p as no address',
    (email) => {
      expect(isPlaceholderEmail(email)).toBe(true);
    },
  );

  it.each(['writer@example.com', 'user-7@invalid.example.com', 'invalid@example.org', 'a@notinvalid'])(
    'counts %p as a real address',
    (email) => {
      expect(isPlaceholderEmail(email)).toBe(false);
    },
  );

  it('sends mail only to a verified address that is not a placeholder', () => {
    expect(canReceiveEmail('writer@example.com', true)).toBe(true);
    expect(canReceiveEmail('writer@example.com', false)).toBe(false);
    expect(canReceiveEmail('user-7@invalid', true)).toBe(false);
    expect(canReceiveEmail(null, true)).toBe(false);
    expect(canReceiveEmail('writer@example.com', undefined)).toBe(false);
  });
});
