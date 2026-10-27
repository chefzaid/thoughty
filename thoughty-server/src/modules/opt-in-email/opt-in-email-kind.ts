/** The emails a writer can opt into; each has its own setting table, schedule and unsubscribe links. */
export const OPT_IN_EMAIL_KINDS = ['on-this-day', 'monthly-recap'] as const;

export type OptInEmailKind = (typeof OPT_IN_EMAIL_KINDS)[number];
