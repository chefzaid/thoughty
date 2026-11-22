/**
 * Phrases that suggest a writer may be thinking of suicide or self-harm, in English and in French. Text is
 * lowercased, stripped of accents and given straight apostrophes first, so the patterns are written that way.
 * They aim at what a person says of themselves ("I want to die", "me faire du mal"), not at every dark word,
 * and the check runs in the browser only: nothing is sent anywhere because of it.
 */
const CRISIS_PATTERNS: readonly RegExp[] = [
  /\bsuicid\w*/,
  /\bkill(?:ing)? myself\b/,
  /\bend(?:ing)? (?:it all|my (?:own )?life)\b/,
  /\btake my (?:own )?life\b/,
  /\bwant(?:s|ed)? to die\b/,
  /\bwish i (?:was|were) dead\b/,
  /\bbetter off dead\b/,
  /\bno reason to (?:live|go on)\b/,
  /\bdon'?t want to (?:live|be alive|wake up)\b/,
  /\bself[- ]?harm\w*/,
  /\b(?:hurt|hurting|cut|cutting) myself\b/,
  /\b(?:envie de|veux|voudrais|vais) me tuer\b/,
  /\bmettre fin a (?:mes jours|ma vie)\b/,
  /\ben finir avec (?:la|ma) vie\b/,
  /\b(?:envie de|veux|voudrais) mourir\b/,
  /\b(?:plus|pas) envie de vivre\b/,
  /\baucune raison de vivre\b/,
  /\bme faire du mal\b/,
  /\bautomutil\w*/,
  /\bscarifi\w*/,
];

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll(/[‘’ʼ`]/g, "'");
}

/** Whether any of the texts (an entry's title and body, chat messages) carries a sign of crisis. */
export function hasCrisisSignal(...texts: ReadonlyArray<string | null | undefined>): boolean {
  return texts.some((text) => {
    if (!text) return false;
    const normalized = normalize(text);
    return CRISIS_PATTERNS.some((pattern) => pattern.test(normalized));
  });
}
