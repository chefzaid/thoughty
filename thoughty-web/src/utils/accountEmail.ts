import type { User } from '../contexts/authTypes';

/**
 * The writer's own address, or '' when the account has none (`emailMissing`: the API then sends a
 * placeholder on the reserved `.invalid` domain, which is never shown or offered as theirs).
 */
export function ownEmail(user: Partial<Pick<User, 'email' | 'emailMissing'>> | null | undefined): string {
  return user?.email && !user.emailMissing ? user.email : '';
}
