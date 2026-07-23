export interface ToneMoodAnalysis {
  dominantMood: string;
  dominantTone: string;
  moodBreakdown: Record<string, number>;
  toneBreakdown: Record<string, number>;
  analyzedEntries: number;
  summary: string;
}

function parseAnalysisLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase().replaceAll(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : null;
}

function parseAnalysisBreakdown(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const breakdownEntries = Object.entries(value)
    .map(([label, count]) => {
      const parsedLabel = parseAnalysisLabel(label);
      const parsedCount =
        typeof count === 'number' ? Math.round(count) : Number.parseInt(String(count), 10);

      if (!parsedLabel || !Number.isFinite(parsedCount) || parsedCount <= 0) {
        return null;
      }

      return [parsedLabel, parsedCount] as const;
    })
    .filter((entry): entry is readonly [string, number] => entry !== null)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 6);

  return Object.fromEntries(breakdownEntries);
}

function getDominantAnalysisLabel(breakdown: Record<string, number>): string | null {
  const [first] = Object.entries(breakdown).sort(([, left], [, right]) => right - left);
  return first?.[0] ?? null;
}

export function parseToneMoodAnalysis(
  rawContent: string,
  analyzedEntries: number,
): ToneMoodAnalysis | null {
  const trimmed = rawContent.trim();
  const objectMatch = /\{[\s\S]*\}/.exec(trimmed);
  const objectCandidate = trimmed.startsWith('{') ? trimmed : (objectMatch?.[0] ?? '{}');

  try {
    const parsed = JSON.parse(objectCandidate) as Record<string, unknown>;
    const moodBreakdown = parseAnalysisBreakdown(parsed.moodBreakdown);
    const toneBreakdown = parseAnalysisBreakdown(parsed.toneBreakdown);
    const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
    const dominantMood =
      parseAnalysisLabel(parsed.dominantMood) ?? getDominantAnalysisLabel(moodBreakdown);
    const dominantTone =
      parseAnalysisLabel(parsed.dominantTone) ?? getDominantAnalysisLabel(toneBreakdown);

    if (
      !dominantMood ||
      !dominantTone ||
      (!summary &&
        Object.keys(moodBreakdown).length === 0 &&
        Object.keys(toneBreakdown).length === 0)
    ) {
      return null;
    }

    return {
      dominantMood,
      dominantTone,
      moodBreakdown,
      toneBreakdown,
      analyzedEntries,
      summary: summary || 'Recent entries show a mixed emotional and tonal profile.',
    };
  } catch {
    return null;
  }
}
