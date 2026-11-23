import { describe, expect, it, vi } from 'vitest';
import { createContactService } from './contactService';

const message = { name: 'Camille', email: 'camille@example.com', message: 'How do I export?', website: '' };

function response(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('contactService', () => {
  it('posts the message as JSON and resolves to null once sent', async () => {
    const authFetch = vi.fn().mockResolvedValue(response({ success: true }, 202));

    await expect(createContactService(authFetch).send(message, 'contactSendError')).resolves.toBeNull();
    expect(authFetch).toHaveBeenCalledWith('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  });

  it('resolves to the translation key of the API error code', async () => {
    const authFetch = vi.fn().mockResolvedValue(
      response({ statusCode: 503, message: 'Off', error: 'Service Unavailable', code: 'CONTACT_NOT_CONFIGURED' }, 503),
    );

    await expect(createContactService(authFetch).send(message, 'contactSendError')).resolves.toBe('apiError_CONTACT_NOT_CONFIGURED');
  });

  it('falls back when the answer says nothing usable or the request fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const service = createContactService(
      vi.fn().mockResolvedValueOnce(new Response('', { status: 500 })).mockRejectedValueOnce(new Error('offline')),
    );

    await expect(service.send(message, 'contactSendError')).resolves.toBe('contactSendError');
    await expect(service.send(message, 'contactSendError')).resolves.toBe('contactSendError');
    expect(consoleError).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });
});
