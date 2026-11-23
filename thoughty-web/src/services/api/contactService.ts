import type { components } from '../../generated/openapi';
import { readApiErrorMessage, type AuthFetchFunction } from './base';

export type ContactMessage = components['schemas']['ContactMessageDto'];

/**
 * Sends a Contact page message (`POST /api/contact`), which the API emails to its inbox. Resolves to null once
 * sent, else to what to show: an `apiError_<CODE>` translation key, the API's message, or `fallback`.
 */
export function createContactService(authFetch: AuthFetchFunction) {
  return {
    async send(message: ContactMessage, fallback: string): Promise<string | null> {
      try {
        const response = await authFetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        });
        return response.ok ? null : await readApiErrorMessage(response, fallback);
      } catch (error) {
        console.error('Error sending contact message:', error);
        return fallback;
      }
    },
  };
}
