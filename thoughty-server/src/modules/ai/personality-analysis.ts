export interface WritingProfileItem {
  label: string;
  count: number;
}

export interface WritingProfile {
  analyzedEntries: number;
  analyzedWords: number;
  averageWordsPerEntry: number;
  truncatedEntries: number;
  fromDate: string;
  toDate: string;
  topWords: WritingProfileItem[];
  topSubjects: WritingProfileItem[];
}

export interface PersonalityTrait {
  label: string;
  score: number;
  evidence: string;
}

export interface PersonalityAssessment {
  traits: PersonalityTrait[];
  summary: string;
}

const MAX_TRAITS = 5;
const MAX_LABEL_LENGTH = 48;
const MAX_EVIDENCE_LENGTH = 280;
const MAX_SUMMARY_LENGTH = 700;
const DISALLOWED_INFERENCE_PATTERNS = [
  /\b(?:diagnos(?:is|e|ed)|disorder|mental illness|race|ethnicity|religion|sexuality|sexual orientation|political affiliation|political opinions|political profile|gender|sex|disability|nationality)\b/i,
  /(?:^|[^\p{L}])(?:diagnos(?:tic|tiqu(?:e|er|é))|trouble|maladie mentale|race|ethnie|origine ethnique|religion|sexualité|orientation sexuelle|affiliation politique|opinions politiques|profil politique|genre|sexe|handicap|nationalité)(?=$|[^\p{L}])/iu,
];

function normalizeText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().replaceAll(/\s+/g, ' ').slice(0, maxLength) : '';
}

function hasDisallowedInference(value: string): boolean {
  return DISALLOWED_INFERENCE_PATTERNS.some((pattern) => pattern.test(value));
}

function parseTrait(value: unknown): PersonalityTrait | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const label = normalizeText(candidate.label, MAX_LABEL_LENGTH);
  const evidence = normalizeText(candidate.evidence, MAX_EVIDENCE_LENGTH);
  const rawScore =
    typeof candidate.score === 'number'
      ? candidate.score
      : Number.parseFloat(String(candidate.score));

  if (
    !label ||
    !evidence ||
    !Number.isFinite(rawScore) ||
    hasDisallowedInference(`${label} ${evidence}`)
  ) {
    return null;
  }

  return {
    label,
    score: Math.max(0, Math.min(100, Math.round(rawScore))),
    evidence,
  };
}

export function parsePersonalityAssessment(rawContent: string): PersonalityAssessment | null {
  const objectMatch = /\{[\s\S]*\}/.exec(rawContent.trim());
  const candidate = rawContent.trim().startsWith('{')
    ? rawContent.trim()
    : (objectMatch?.[0] ?? '{}');

  try {
    const parsed = JSON.parse(candidate) as Record<string, unknown>;
    const summary = normalizeText(parsed.summary, MAX_SUMMARY_LENGTH);
    const traits = Array.isArray(parsed.traits)
      ? parsed.traits
          .map(parseTrait)
          .filter((trait): trait is PersonalityTrait => trait !== null)
          .filter(
            (trait, index, allTraits) =>
              allTraits.findIndex(
                (candidateTrait) =>
                  candidateTrait.label.toLowerCase() === trait.label.toLowerCase(),
              ) === index,
          )
          .slice(0, MAX_TRAITS)
      : [];

    if (traits.length === 0 || !summary || hasDisallowedInference(summary)) {
      return null;
    }

    return { traits, summary };
  } catch {
    return null;
  }
}
