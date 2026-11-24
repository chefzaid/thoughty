/**
 * The stand-in address of an account that had none (migration 1790380800000): `user-<id>@invalid`. The
 * `.invalid` top-level domain is reserved and never resolves (RFC 6761), so no mail can reach it; the
 * writer is asked for a real address at their next sign-in.
 */
export function placeholderEmail(userId: number): string {
  return `user-${userId}@invalid`;
}

/**
 * Whether an address is no address at all: empty, or on the reserved `.invalid` domain (an account's
 * placeholder, or any address no mail can reach). Nothing is ever sent to it, it is never accepted as a
 * writer's own, and the data download leaves it out.
 */
export function isPlaceholderEmail(email: string | null | undefined): boolean {
  const domain = email?.trim().toLowerCase().split('@').pop() ?? '';
  return !email?.includes('@') || domain === 'invalid' || domain.endsWith('.invalid');
}

/** Whether mail may go to an account's address: proven by the writer, and not a placeholder. */
export function canReceiveEmail(email: string | null | undefined, emailVerified: boolean | null | undefined): boolean {
  return emailVerified === true && !isPlaceholderEmail(email);
}
