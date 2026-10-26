/** The configured number of tags to add automatically on save, from 0 (off) to 10. */
export const getAutoTagLimit = (value: string | number | undefined): number => {
  const parsed = Number.parseInt(String(value ?? '0'), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.min(parsed, 10);
};
