import { createHmac } from 'node:crypto';
import { createEmailUnsubscribeToken, verifyEmailUnsubscribeToken } from './email-unsubscribe-token';

const SECRET = 'a'.repeat(48);

describe('email unsubscribe tokens', () => {
  it('name the email and the writer they were signed for', () => {
    const recap = createEmailUnsubscribeToken('monthly-recap', 42, SECRET);
    const onThisDay = createEmailUnsubscribeToken('on-this-day', 42, SECRET);

    expect(recap).toMatch(/^recap\.42\.[\w-]{43}$/);
    expect(onThisDay).toMatch(/^42\.[\w-]{43}$/);
    expect(verifyEmailUnsubscribeToken(recap, SECRET)).toEqual({ kind: 'monthly-recap', userId: 42 });
    expect(verifyEmailUnsubscribeToken(onThisDay, SECRET)).toEqual({ kind: 'on-this-day', userId: 42 });
    expect(recap.length).toBeLessThanOrEqual(64);
  });

  it('keep reading the links "On this day" emails carried before there was a second email', () => {
    const legacy = `7.${createHmac('sha256', SECRET).update('on-this-day-email:unsubscribe:7').digest('base64url')}`;

    expect(verifyEmailUnsubscribeToken(legacy, SECRET)).toEqual({ kind: 'on-this-day', userId: 7 });
  });

  it('never let one email’s signature turn another off, and refuse unknown kinds and forgeries', () => {
    const [, , signature] = createEmailUnsubscribeToken('monthly-recap', 42, SECRET).split('.');

    expect(verifyEmailUnsubscribeToken(`42.${signature}`, SECRET)).toBeNull();
    expect(verifyEmailUnsubscribeToken(`daily.42.${signature}`, SECRET)).toBeNull();
    expect(verifyEmailUnsubscribeToken(`recap.43.${signature}`, SECRET)).toBeNull();
    expect(verifyEmailUnsubscribeToken(createEmailUnsubscribeToken('monthly-recap', 42, 'b'.repeat(48)), SECRET)).toBeNull();
    expect(verifyEmailUnsubscribeToken('recap.42', SECRET)).toBeNull();
    expect(verifyEmailUnsubscribeToken('', SECRET)).toBeNull();
  });
});
