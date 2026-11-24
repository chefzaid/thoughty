import { isPlaceholderEmail } from '@/common/utils/placeholder-email.util';
import type { User } from '@/database/entities';

/** What a client is told of an account's address besides the address itself. */
export interface AccountEmailFields {
  emailMissing: boolean;
  pendingEmail?: string;
}

/**
 * Whether the account has no real address (a placeholder stands in), and the address waiting for its link
 * to be opened, if any: the web asks a writer without one for an address before anything else.
 */
export function accountEmailFields(user: Pick<User, 'email' | 'pendingEmail'>): AccountEmailFields {
  return {
    emailMissing: isPlaceholderEmail(user.email),
    ...(user.pendingEmail ? { pendingEmail: user.pendingEmail } : {}),
  };
}
