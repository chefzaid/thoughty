interface StatsEntry {
  id: number;
  date: string;
  index: number;
  content: string;
  tags: string[];
  mood?: number | null;
  feelings?: string[];
}

const roundMood = (value: number) => Math.round(value * 10) / 10;

/** Recorded moods summed up as the server does: by month, by weekday (Monday first), and the top feelings. */
export function buildMockMoods(entries: StatsEntry[]) {
  const recorded = entries.filter((entry) => typeof entry.mood === "number") as Array<StatsEntry & { mood: number }>;
  const levels = [0, 0, 0, 0, 0];
  const months = new Map<string, { total: number; entries: number }>();
  const weekdays = Array.from({ length: 7 }, () => ({ total: 0, entries: 0 }));
  for (const entry of recorded) {
    levels[entry.mood - 1]++;
    const month = months.get(entry.date.slice(0, 7)) ?? { total: 0, entries: 0 };
    month.total += entry.mood;
    month.entries++;
    months.set(entry.date.slice(0, 7), month);
    const weekday = weekdays[(new Date(`${entry.date}T00:00:00Z`).getUTCDay() + 6) % 7]!;
    weekday.total += entry.mood;
    weekday.entries++;
  }
  const feelings = new Map<string, number>();
  for (const entry of entries) {
    for (const feeling of entry.feelings ?? []) feelings.set(feeling, (feelings.get(feeling) ?? 0) + 1);
  }
  const total = recorded.reduce((sum, entry) => sum + entry.mood, 0);

  return {
    recordedEntries: recorded.length,
    averageMood: recorded.length > 0 ? roundMood(total / recorded.length) : null,
    levels,
    months: [...months.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([month, value]) => ({ month, average: roundMood(value.total / value.entries), entries: value.entries })),
    weekdays: weekdays.map((value) => ({ average: value.entries > 0 ? roundMood(value.total / value.entries) : null, entries: value.entries })),
    topFeelings: [...feelings.entries()]
      .map(([feeling, count]) => ({ feeling, count }))
      .sort((left, right) => right.count - left.count || left.feeling.localeCompare(right.feeling))
      .slice(0, 10),
  };
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
    moods: buildMockMoods(entries),
  };
}
