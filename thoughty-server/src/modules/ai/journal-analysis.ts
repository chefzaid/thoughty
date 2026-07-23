export interface ToneMoodAnalysis {
  dominantMood: string;
  dominantTone: string;
  moodBreakdown: Record<string, number>;
  toneBreakdown: Record<string, number>;
  analyzedEntries: number;
  summary: string;
}

export interface SubjectAnalysis {
  subjectBreakdown: Record<string, number>;
  analyzedEntries: number;
  summary: string;
}

export interface JournalAnalysis {
  toneMoodAnalysis: ToneMoodAnalysis | null;
  subjectAnalysis: SubjectAnalysis | null;
}

const MAX_LABEL_LENGTH = 48;
const MAX_SUMMARY_LENGTH = 500;

function parseAnalysisLabel(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase().replaceAll(/\s+/g, ' ').slice(0, MAX_LABEL_LENGTH);
  return normalized.length > 0 ? normalized : null;
}

function parseAnalysisSummary(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, MAX_SUMMARY_LENGTH) : '';
}

function parseAnalysisBreakdown(
  value: unknown,
  analyzedEntries: number,
  limit: number,
): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const normalizedCounts = new Map<string, number>();
  for (const [label, count] of Object.entries(value)) {
    const parsedLabel = parseAnalysisLabel(label);
    const parsedCount =
      typeof count === 'number' ? Math.round(count) : Number.parseInt(String(count), 10);

    if (!parsedLabel || !Number.isFinite(parsedCount) || parsedCount <= 0) {
      continue;
    }

    const boundedCount = Math.min(parsedCount, analyzedEntries);
    normalizedCounts.set(
      parsedLabel,
      Math.max(normalizedCounts.get(parsedLabel) ?? 0, boundedCount),
    );
  }

  const breakdownEntries = [...normalizedCounts.entries()]
    .sort(([, left], [, right]) => right - left)
    .slice(0, limit);

  return Object.fromEntries(breakdownEntries);
}

function getDominantAnalysisLabel(breakdown: Record<string, number>): string | null {
  return Object.keys(breakdown)[0] ?? null;
}

function parseToneMoodSection(
  parsed: Record<string, unknown>,
  analyzedEntries: number,
): ToneMoodAnalysis | null {
  const moodBreakdown = parseAnalysisBreakdown(parsed.moodBreakdown, analyzedEntries, 6);
  const toneBreakdown = parseAnalysisBreakdown(parsed.toneBreakdown, analyzedEntries, 6);
  const summary = parseAnalysisSummary(parsed.summary);
  const dominantMood =
    parseAnalysisLabel(parsed.dominantMood) ?? getDominantAnalysisLabel(moodBreakdown);
  const dominantTone =
    parseAnalysisLabel(parsed.dominantTone) ?? getDominantAnalysisLabel(toneBreakdown);

  if (
    !dominantMood ||
    !dominantTone ||
    (!summary && Object.keys(moodBreakdown).length === 0 && Object.keys(toneBreakdown).length === 0)
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
}

function parseSubjectSection(
  parsed: Record<string, unknown>,
  analyzedEntries: number,
): SubjectAnalysis | null {
  const subjectBreakdown = parseAnalysisBreakdown(parsed.subjectBreakdown, analyzedEntries, 8);
  const summary = parseAnalysisSummary(parsed.subjectSummary);

  if (Object.keys(subjectBreakdown).length === 0) {
    return null;
  }

  return {
    subjectBreakdown,
    analyzedEntries,
    summary,
  };
}

export function parseJournalAnalysis(
  rawContent: string,
  analyzedEntries: number,
): JournalAnalysis | null {
  if (!Number.isInteger(analyzedEntries) || analyzedEntries <= 0) {
    return null;
  }

  const trimmed = rawContent.trim();
  const objectMatch = /\{[\s\S]*\}/.exec(trimmed);
  const objectCandidate = trimmed.startsWith('{') ? trimmed : (objectMatch?.[0] ?? '{}');

  try {
    const parsed = JSON.parse(objectCandidate) as Record<string, unknown>;
    const toneMoodAnalysis = parseToneMoodSection(parsed, analyzedEntries);
    const subjectAnalysis = parseSubjectSection(parsed, analyzedEntries);

    if (!toneMoodAnalysis && !subjectAnalysis) {
      return null;
    }

    return { toneMoodAnalysis, subjectAnalysis };
  } catch {
    return null;
  }
}
