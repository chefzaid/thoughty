interface StatsEntry {
  id: number;
  date: string;
  index: number;
  content: string;
  tags: string[];
}

function buildMockCorrelations(entries: StatsEntry[]) {
  const entryConnections = entries
    .slice(1)
    .map((entry, index) => {
      const target = entries[index];
      const sharedTags = entry.tags.filter((tag) => target.tags.includes(tag));
      return {
        sourceEntryId: entry.id,
        sourceDate: entry.date,
        sourceIndex: entry.index,
        targetEntryId: target.id,
        targetDate: target.date,
        targetIndex: target.index,
        sharedTags,
        score: sharedTags.length > 0 ? 70 : 0,
      };
    })
    .filter((connection) => connection.sharedTags.length > 0)
    .slice(0, 12);

  const tagCounts = new Map<string, number>();
  const pairCounts = new Map<
    string,
    { firstTag: string; secondTag: string; sharedEntries: number }
  >();
  for (const entry of entries) {
    const tags = [...new Set(entry.tags)].sort((a, b) => a.localeCompare(b));
    for (const tag of tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    for (let first = 0; first < tags.length; first += 1) {
      for (let second = first + 1; second < tags.length; second += 1) {
        const key = `${tags[first]}\u0000${tags[second]}`;
        const pair = pairCounts.get(key) ?? {
          firstTag: tags[first],
          secondTag: tags[second],
          sharedEntries: 0,
        };
        pair.sharedEntries += 1;
        pairCounts.set(key, pair);
      }
    }
  }

  const tagConnections = [...pairCounts.values()]
    .map((pair) => ({
      ...pair,
      strength: Math.round(
        (pair.sharedEntries /
          Math.sqrt(
            (tagCounts.get(pair.firstTag) ?? 1) *
              (tagCounts.get(pair.secondTag) ?? 1),
          )) *
          100,
      ),
    }))
    .sort(
      (left, right) =>
        right.strength - left.strength ||
        left.firstTag.localeCompare(right.firstTag),
    )
    .slice(0, 12);

  return {
    analyzedEntries: entries.length,
    entryConnections,
    tagConnections,
  };
}

export function buildStats(entries: StatsEntry[]) {
  const thoughtsPerYear: Record<string, number> = {};
  const thoughtsPerMonth: Record<string, number> = {};
  const thoughtsPerDay: Record<string, number> = {};
  const thoughtsPerTag: Record<string, number> = {};
  const tagsPerYear: Record<string, Record<string, number>> = {};

  for (const entry of entries) {
    const year = entry.date.slice(0, 4);
    const month = entry.date.slice(0, 7);

    thoughtsPerYear[year] = (thoughtsPerYear[year] || 0) + 1;
    thoughtsPerMonth[month] = (thoughtsPerMonth[month] || 0) + 1;
    thoughtsPerDay[entry.date] = (thoughtsPerDay[entry.date] || 0) + 1;
    tagsPerYear[year] ||= {};

    for (const tag of entry.tags) {
      thoughtsPerTag[tag] = (thoughtsPerTag[tag] || 0) + 1;
      tagsPerYear[year][tag] = (tagsPerYear[year][tag] || 0) + 1;
    }
  }

  return {
    totalThoughts: entries.length,
    averageWordsPerEntry:
      entries.length > 0
        ? Math.round(
            entries.reduce(
              (total, entry) => total + entry.content.split(/\s+/).length,
              0,
            ) / entries.length,
          )
        : 0,
    averageReadingTimeMinutes: entries.length > 0 ? 1 : 0,
    uniqueTagsCount: Object.keys(thoughtsPerTag).length,
    thoughtsPerYear,
    thoughtsPerMonth,
    thoughtsPerDay,
    thoughtsPerTag,
    tagsPerYear,
    tagsPerMonth: {},
    toneMoodAnalysis: null,
    subjectAnalysis:
      entries.length > 0
        ? {
            subjectBreakdown: thoughtsPerTag,
            analyzedEntries: entries.length,
            summary: "Recent entries focus on reflection, focus, and work.",
          }
        : null,
    correlations: buildMockCorrelations(entries),
  };
}
