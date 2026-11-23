import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { RATE_LIMITS } from '@/common/rate-limit.constants';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { ContactController } from './contact.controller';

describe('ContactController', () => {
  const service = { send: jest.fn() };
  const controller = new ContactController(service as never);
  const handler = ContactController.prototype.send;

  afterEach(() => jest.clearAllMocks());

  it('is public, answers 202 and allows five messages an hour from one address', () => {
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    expect(Reflect.getMetadata(HTTP_CODE_METADATA, handler)).toBe(202);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(RATE_LIMITS.contactMessage.limit);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(RATE_LIMITS.contactMessage.ttl);
    expect(RATE_LIMITS.contactMessage).toEqual({ limit: 5, ttl: 60 * 60 * 1000 });
  });

  it('sends the message and answers success', async () => {
    const dto = { name: 'Camille', email: 'camille@example.com', message: 'How do I export my journal?' };
    service.send.mockResolvedValue(undefined);

    await expect(controller.send(dto)).resolves.toEqual({ success: true });
    expect(service.send).toHaveBeenCalledWith(dto);
  });

  it('lets a refusal through', async () => {
    service.send.mockRejectedValue(new Error('refused'));
    await expect(controller.send({ name: 'A', email: 'a@example.com', message: 'Hello there!' })).rejects.toThrow('refused');
  });
});
