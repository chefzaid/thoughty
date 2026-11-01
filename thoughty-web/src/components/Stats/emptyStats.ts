import type { components } from '../../generated/openapi';

export type StatsData = components['schemas']['StatsResponseDto'];

/**
 * What Stats falls back on for a part the server did not send (one from before that part existed). The
 * words used most have no such stand-in: without them their card is not shown.
 */
export const EMPTY_STATS: Omit<StatsData, 'topWords'> = {
    totalThoughts: 0,
    averageWordsPerEntry: 0,
    averageReadingTimeMinutes: 0,
    uniqueTagsCount: 0,
    thoughtsPerYear: {},
    thoughtsPerMonth: {},
    thoughtsPerDay: {},
    thoughtsPerTag: {},
    tagsPerYear: {},
    tagsPerMonth: {},
    toneMoodAnalysis: null,
    subjectAnalysis: null,
    correlations: {
        analyzedEntries: 0,
        entryConnections: [],
        tagConnections: [],
    },
    moods: {
        recordedEntries: 0,
        averageMood: null,
        levels: [0, 0, 0, 0, 0],
        months: [],
        weekdays: [],
        topFeelings: [],
        goodMoodTags: [],
        lowMoodTags: [],
    },
    goals: [],
    writingTimes: {
        hours: Array.from({ length: 24 }, () => 0),
        weekdays: [0, 0, 0, 0, 0, 0, 0],
    },
    records: {
        longestEntry: null,
        busiestDay: null,
        longestStreak: null,
        earliestEntry: null,
        latestEntry: null,
        firstEntry: null,
    },
};
