/** Extract a JSON candidate from prose without regex backtracking on malformed AI output. */
export function extractJsonCandidate(raw: string, opening: '{' | '['): string | undefined {
  const content = raw.trim();
  if (content.startsWith(opening)) return content;
  const start = content.indexOf(opening);
  const end = content.lastIndexOf(opening === '{' ? '}' : ']');
  return start >= 0 && end > start ? content.slice(start, end + 1) : undefined;
}

export function trimCharacters(value: string, characters: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && characters.includes(value[start])) start += 1;
  while (end > start && characters.includes(value[end - 1])) end -= 1;
  return value.slice(start, end);
}
