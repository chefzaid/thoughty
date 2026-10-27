/** Markdown reduced to readable text, cut at a word boundary. */
export function plainExcerpt(content: string, maxLength: number): string {
  const text = content
    .replaceAll(/```[\s\S]*?```/g, ' ')
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, '')
    .replaceAll(/[*_~`]+/g, '')
    .replaceAll(/\\([\\`*_[\]{}()#+\-.!>])/g, '$1')
    .replaceAll(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) {
    return text;
  }
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
