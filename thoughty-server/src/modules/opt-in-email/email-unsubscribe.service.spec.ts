import { BadRequestException } from '@nestjs/common';
import { expectApiError } from '@/common/errors/api-error.test-helpers';
import { createEmailUnsubscribeToken } from './email-unsubscribe-token';
import { EmailUnsubscribeController } from './email-unsubscribe.controller';
import { EmailUnsubscribeService } from './email-unsubscribe.service';

describe('EmailUnsubscribeService', () => {
  const secret = 'u'.repeat(48);
  let onThisDay: { update: jest.Mock };
  let monthlyRecap: { update: jest.Mock };
  let service: EmailUnsubscribeService;

  beforeEach(() => {
    onThisDay = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    monthlyRecap = { update: jest.fn().mockResolvedValue({ affected: 0 }) };
    service = new EmailUnsubscribeService(
      onThisDay as never,
      monthlyRecap as never,
      { get: jest.fn((key: string) => (key === 'UNSUBSCRIBE_SECRET' ? secret : undefined)) } as never,
    );
  });

  it('turns off only the email the signed link names, and says which one', async () => {
    await expect(service.unsubscribe(createEmailUnsubscribeToken('monthly-recap', 3, secret))).resolves.toEqual({ success: true, kind: 'monthly-recap' });
    expect(monthlyRecap.update).toHaveBeenCalledWith({ userId: 3, enabled: true }, { enabled: false });
    expect(onThisDay.update).not.toHaveBeenCalled();

    await expect(service.unsubscribe(createEmailUnsubscribeToken('on-this-day', 3, secret))).resolves.toEqual({ success: true, kind: 'on-this-day' });
    expect(onThisDay.update).toHaveBeenCalledWith({ userId: 3, enabled: true }, { enabled: false });
  });

  it('refuses a link signed with another key, or none', async () => {
    await expectApiError(service.unsubscribe(createEmailUnsubscribeToken('monthly-recap', 3, 'other'.repeat(10))), BadRequestException, 'EMAIL_UNSUBSCRIBE_INVALID');
    await expectApiError(service.unsubscribe('nonsense'), BadRequestException, 'EMAIL_UNSUBSCRIBE_INVALID');
    expect(monthlyRecap.update).not.toHaveBeenCalled();
  });

  it('is what the public route answers', async () => {
    const unsubscribe = jest.fn().mockResolvedValue({ success: true, kind: 'monthly-recap' });
    const controller = new EmailUnsubscribeController({ unsubscribe } as never);

    await expect(controller.unsubscribe({ token: 'recap.3.abc' })).resolves.toEqual({ success: true, kind: 'monthly-recap' });
    expect(unsubscribe).toHaveBeenCalledWith('recap.3.abc');
  });
});
