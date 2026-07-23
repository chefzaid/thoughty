import { parseJournalAnalysis } from './journal-analysis';

describe('parseJournalAnalysis', () => {
  it('parses independently valid tone and subject sections', () => {
    const result = parseJournalAnalysis(
      JSON.stringify({
        dominantMood: ' Calm ',
        dominantTone: 'Reflective',
        moodBreakdown: { Calm: 20, hopeful: 2 },
        toneBreakdown: { Reflective: 3 },
        summary: 'A calm period.',
        subjectBreakdown: { Work: 9, ' work ': 1, Relationships: 2 },
        subjectSummary: 'Work and relationships recur.',
      }),
      3,
    );

    expect(result).toEqual({
      toneMoodAnalysis: {
        dominantMood: 'calm',
        dominantTone: 'reflective',
        moodBreakdown: { calm: 3, hopeful: 2 },
        toneBreakdown: { reflective: 3 },
        analyzedEntries: 3,
        summary: 'A calm period.',
      },
      subjectAnalysis: {
        subjectBreakdown: { work: 3, relationships: 2 },
        analyzedEntries: 3,
        summary: 'Work and relationships recur.',
      },
    });
  });

  it('keeps valid subjects when tone fields are malformed', () => {
    const result = parseJournalAnalysis(
      JSON.stringify({
        subjectBreakdown: { creativity: 2 },
        subjectSummary: 'Creative projects lead the recent entries.',
      }),
      2,
    );

    expect(result).toEqual({
      toneMoodAnalysis: null,
      subjectAnalysis: {
        subjectBreakdown: { creativity: 2 },
        analyzedEntries: 2,
        summary: 'Creative projects lead the recent entries.',
      },
    });
  });

  it('limits labels, summaries, and the number of subjects', () => {
    const subjects = Object.fromEntries(
      Array.from({ length: 10 }, (_, index) => [`subject ${index}`, index + 1]),
    );
    subjects['x'.repeat(60)] = 1;

    const result = parseJournalAnalysis(
      JSON.stringify({
        subjectBreakdown: subjects,
        subjectSummary: 's'.repeat(600),
      }),
      20,
    );

    expect(Object.keys(result?.subjectAnalysis?.subjectBreakdown ?? {})).toHaveLength(8);
    expect(
      Object.keys(result?.subjectAnalysis?.subjectBreakdown ?? {}).every(
        (label) => label.length <= 48,
      ),
    ).toBe(true);
    expect(result?.subjectAnalysis?.summary).toHaveLength(500);
  });

  it('returns null for invalid JSON or empty analysis sections', () => {
    expect(parseJournalAnalysis('not-json', 3)).toBeNull();
    expect(parseJournalAnalysis('{}', 3)).toBeNull();
    expect(parseJournalAnalysis('{"subjectBreakdown":{"work":1}}', 0)).toBeNull();
  });

  it('keeps valid subject counts when the optional summary is missing', () => {
    expect(parseJournalAnalysis('{"subjectBreakdown":{"work":1}}', 1)?.subjectAnalysis).toEqual({
      subjectBreakdown: { work: 1 },
      analyzedEntries: 1,
      summary: '',
    });
  });
});
