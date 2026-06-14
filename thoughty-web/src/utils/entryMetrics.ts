const WORDS_PER_MINUTE = 200;

function removeMarkdownSyntax(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/[#>*_~|[\]()-]/g, ' ');
}

export function countEntryWords(content: string): number {
  const text = removeMarkdownSyntax(content).trim();

  if (!text) {
    return 0;
  }

  return text.split(/\s+/).filter(Boolean).length;
}

export function estimateReadingTimeMinutes(wordCount: number): number {
  if (wordCount <= 0) {
    return 0;
  }

  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

export function getEntryMetrics(content: string): {
  wordCount: number;
  readingTimeMinutes: number;
} {
  const wordCount = countEntryWords(content);

  return {
    wordCount,
    readingTimeMinutes: estimateReadingTimeMinutes(wordCount),
  };
}
