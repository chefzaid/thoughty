/** When a draft was saved, in the reader's language: the time alone for today, else the date too. */
export function formatDraftTime(updatedAt: string, language: string, now = new Date()): string {
  const saved = new Date(updatedAt);
  const today = saved.toDateString() === now.toDateString();
  const options: Intl.DateTimeFormatOptions = today
    ? { hour: 'numeric', minute: '2-digit' }
    : { dateStyle: 'medium', timeStyle: 'short' };
  try {
    return new Intl.DateTimeFormat(language, options).format(saved);
  } catch {
    return saved.toLocaleString();
  }
}
