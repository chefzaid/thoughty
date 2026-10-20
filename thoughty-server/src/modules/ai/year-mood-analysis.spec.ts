import { buildYearMoodPrompt, parseYearMood, YEAR_MOOD_INSTRUCTIONS } from './year-mood-analysis';

describe('year mood analysis', () => {
  it('groups the sampled entries by month in the prompt', () => {
    expect(buildYearMoodPrompt([
      { month: '2025-01', entries: [{ date: '2025-01-04', text: 'Snow day.' }, { date: '2025-01-20', text: 'New job.' }] },
      { month: '2025-02', entries: [{ date: '2025-02-02', text: 'Tired.' }] },
    ])).toBe('Month 2025-01\n- 2025-01-04: Snow day.\n- 2025-01-20: New job.\n\nMonth 2025-02\n- 2025-02-02: Tired.');
    expect(YEAR_MOOD_INSTRUCTIONS).toContain('Do not diagnose');
  });

  it('keeps requested months in calendar order with bounded valence and short moods', () => {
    const raw = 'Here you go: ' + JSON.stringify({
      months: [
        { month: '2025-03', mood: '  Quietly  HOPEFUL and calm on most of the days ', valence: 1.6 },
        { month: '2025-01', mood: 'restless', valence: -7 },
        { month: '2025-01', mood: 'duplicate', valence: 2 },
        { month: '2024-12', mood: 'not asked', valence: 0 },
        { month: '2025-02', mood: '', valence: 0 },
        { month: '2025-04', mood: 'bright', valence: 'two' },
        'nonsense',
      ],
      summary: ' A slow start that opened up by spring. ',
    });

    expect(parseYearMood(raw, ['2025-01', '2025-02', '2025-03', '2025-04'])).toEqual({
      months: [
        { month: '2025-01', mood: 'restless', valence: -2 },
        { month: '2025-03', mood: 'quietly hopeful and calm on most', valence: 2 },
      ],
      summary: 'A slow start that opened up by spring.',
    });
  });

  it('drops clinical labels and rejects answers without a usable month or summary', () => {
    expect(parseYearMood(JSON.stringify({ months: [{ month: '2025-01', mood: 'depressed', valence: -2 }], summary: 'Hard winter.' }), ['2025-01'])).toBeNull();
    expect(parseYearMood(JSON.stringify({ months: [{ month: '2025-01', mood: 'heavy', valence: -2 }], summary: 'Signs of a dépression.' }), ['2025-01'])).toBeNull();
    expect(parseYearMood(JSON.stringify({ months: [{ month: '2025-01', mood: 'calm', valence: 1 }] }), ['2025-01'])).toBeNull();
    expect(parseYearMood('not json at all', ['2025-01'])).toBeNull();
    expect(parseYearMood('{"months": "nope", "summary": "x"}', ['2025-01'])).toBeNull();
  });
});
