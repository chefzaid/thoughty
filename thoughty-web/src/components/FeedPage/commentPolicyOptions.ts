import type { CommentPolicy } from '../../services/api';

/** Each choice of who may comment on a public entry, with the text naming it. */
export const COMMENT_POLICY_OPTIONS: ReadonlyArray<{ value: CommentPolicy; label: string }> = [
  { value: 'everyone', label: 'commentPolicyEveryone' },
  { value: 'followers', label: 'commentPolicyFollowers' },
  { value: 'closed', label: 'commentPolicyClosed' },
];
