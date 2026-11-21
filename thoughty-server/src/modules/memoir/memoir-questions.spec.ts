import {
  MEMOIR_CHAPTERS,
  MEMOIR_QUESTIONS,
  MEMOIR_THEME_IDS,
  findMemoirChapter,
  findMemoirQuestion,
  isSnoozed,
  memoirChaptersFor,
  memoirQuestionsFor,
  nextQueuedQuestion,
  nextUnansweredQuestion,
  normalizeMemoirThemes,
  resolveMemoirLanguage,
} from './memoir-questions';

describe('memoir questions', () => {
  it('offers every writer a year of weekly questions in life order', () => {
    expect(memoirQuestionsFor([])).toHaveLength(52);
    expect(memoirChaptersFor([]).map((chapter) => chapter.id)).toEqual([
      'childhood',
      'growing-up',
      'family',
      'love',
      'work',
      'places',
      'lessons',
    ]);
  });

  it('keeps themed chapters at their place in the life story, each in English and French', () => {
    expect(MEMOIR_THEME_IDS).toEqual(['parenthood', 'careers', 'migration', 'history', 'faith']);
    expect(MEMOIR_CHAPTERS.map((chapter) => chapter.id)).toEqual([
      'childhood',
      'growing-up',
      'family',
      'love',
      'parenthood',
      'work',
      'careers',
      'places',
      'migration',
      'history',
      'faith',
      'lessons',
    ]);
    expect(MEMOIR_QUESTIONS).toHaveLength(87);
    expect(new Set(MEMOIR_QUESTIONS.map((question) => question.id)).size).toBe(87);
    expect(new Set(MEMOIR_QUESTIONS.flatMap((question) => [question.text.en, question.text.fr])).size).toBe(174);
    for (const question of MEMOIR_QUESTIONS) {
      expect(question.id).toMatch(/^[a-z][a-z-]{0,63}$/);
      expect(question.text.en.trim()).not.toBe('');
      expect(question.text.fr.trim()).not.toBe('');
      expect(findMemoirChapter(question.chapterId)?.questions).toContain(question);
    }
    for (const chapter of MEMOIR_CHAPTERS) {
      expect(chapter.title.en.length).toBeLessThanOrEqual(50);
      expect(chapter.title.fr.length).toBeLessThanOrEqual(50);
    }
  });

  it('builds a memoir from the year and the chosen themes, in life order', () => {
    expect(memoirChaptersFor(['faith', 'parenthood']).map((chapter) => chapter.id)).toEqual([
      'childhood',
      'growing-up',
      'family',
      'love',
      'parenthood',
      'work',
      'places',
      'faith',
      'lessons',
    ]);
    expect(memoirQuestionsFor(MEMOIR_THEME_IDS)).toEqual(MEMOIR_QUESTIONS);
    expect(memoirChaptersFor(['childhood', 'unknown'])).toEqual(memoirChaptersFor([]));
  });

  it('keeps known themes once each, in life order', () => {
    expect(normalizeMemoirThemes(['faith', 'migration', 'faith', 'retired', 'childhood'])).toEqual(['migration', 'faith']);
    expect(normalizeMemoirThemes([])).toEqual([]);
  });

  it('finds questions and chapters by id', () => {
    expect(findMemoirQuestion('childhood-home')?.chapterId).toBe('childhood');
    expect(findMemoirQuestion('missing')).toBeUndefined();
    expect(findMemoirChapter('lessons')?.title.fr).toBe('Leçons de vie');
    expect(findMemoirChapter('missing')).toBeUndefined();
  });

  it('falls back to English for languages without memoir copy', () => {
    expect(resolveMemoirLanguage('fr')).toBe('fr');
    expect(resolveMemoirLanguage('en')).toBe('en');
    expect(resolveMemoirLanguage('de')).toBe('en');
    expect(resolveMemoirLanguage(undefined)).toBe('en');
  });

  describe('nextUnansweredQuestion', () => {
    const ids = memoirQuestionsFor([]).map((question) => question.id);

    it('starts with the first question and skips answered ones', () => {
      expect(nextUnansweredQuestion(null, new Set())?.id).toBe(ids[0]);
      expect(nextUnansweredQuestion(null, new Set(ids.slice(0, 3)))?.id).toBe(ids[3]);
    });

    it('moves past the current question and wraps around to earlier unanswered ones', () => {
      expect(nextUnansweredQuestion(ids[0], new Set())?.id).toBe(ids[1]);
      expect(nextUnansweredQuestion(ids[51], new Set([ids[0]]))?.id).toBe(ids[1]);
    });

    it('treats an unknown current question like no question', () => {
      expect(nextUnansweredQuestion('retired-question', new Set())?.id).toBe(ids[0]);
    });

    it('can reach the last question when nothing is current', () => {
      expect(nextUnansweredQuestion(null, new Set(ids.slice(0, 51)))?.id).toBe(ids[51]);
    });

    it('keeps the current question when it is the only one left, and ends once all are answered', () => {
      const allButLast = new Set(ids.slice(0, 51));
      expect(nextUnansweredQuestion(ids[51], allButLast)?.id).toBe(ids[51]);
      expect(nextUnansweredQuestion(ids[51], new Set(ids))).toBeNull();
      expect(nextUnansweredQuestion(null, new Set(ids))).toBeNull();
    });

    it('mixes a chosen theme into the queue at its place in life order', () => {
      const lastLove = 'love-advice';
      expect(nextUnansweredQuestion(lastLove, new Set())?.id).toBe('work-path');
      expect(nextUnansweredQuestion(lastLove, new Set(), ['parenthood'])?.id).toBe('parenthood-news');
      expect(nextUnansweredQuestion('lessons-remembered', new Set(ids.slice(0, 51)), ['faith'])?.id).toBe('faith-upbringing');
    });

    it('goes on after a current question whose theme was left out', () => {
      expect(nextUnansweredQuestion('parenthood-names', new Set())?.id).toBe('work-path');
      expect(nextUnansweredQuestion('parenthood-names', new Set(ids), ['careers'])?.id).toBe('careers-first-job');
    });

    it('never keeps a current question from a theme left out', () => {
      expect(nextUnansweredQuestion('faith-doubt', new Set(ids))).toBeNull();
      expect(nextUnansweredQuestion('faith-doubt', new Set(ids), ['faith'])?.id).toBe('faith-community');
    });
  });
  describe('nextQueuedQuestion', () => {
    const ids = memoirQuestionsFor([]).map((question) => question.id);
    const today = '2026-11-02';

    it('treats a set-aside question as away until its day, and back from that day on', () => {
      const snoozes = new Map([[ids[1], '2026-11-02']]);
      expect(isSnoozed(ids[1], snoozes, '2026-11-01')).toBe(true);
      expect(isSnoozed(ids[1], snoozes, '2026-11-02')).toBe(false);
      expect(isSnoozed(ids[2], snoozes, '2026-11-01')).toBe(false);
    });

    it('passes over questions still set aside and keeps life order otherwise', () => {
      const snoozes = new Map([[ids[1], '2026-11-30'], [ids[2], '2026-11-23']]);
      expect(nextQueuedQuestion(ids[0], new Set(), snoozes, today)?.id).toBe(ids[3]);
      expect(nextQueuedQuestion(ids[0], new Set(), new Map(), today)?.id).toBe(ids[1]);
    });

    it('offers a question whose day has come before the rest of the queue, the earliest day first', () => {
      const snoozes = new Map([[ids[30], '2026-11-02'], [ids[10], '2026-10-26'], [ids[5], '2026-11-30']]);
      expect(nextQueuedQuestion(ids[20], new Set(), snoozes, today)?.id).toBe(ids[10]);
      expect(nextQueuedQuestion(ids[20], new Set([ids[10]]), snoozes, today)?.id).toBe(ids[30]);
    });

    it('never brings back the current question or an answered one', () => {
      const snoozes = new Map([[ids[4], '2026-10-01']]);
      expect(nextQueuedQuestion(ids[4], new Set(), snoozes, today)?.id).toBe(ids[5]);
      expect(nextQueuedQuestion(ids[0], new Set([ids[4]]), snoozes, today)?.id).toBe(ids[1]);
    });

    it('has nothing to offer when every unanswered question is set aside', () => {
      const answered = new Set(ids.slice(0, 50));
      const snoozes = new Map([[ids[50], '2026-11-23'], [ids[51], '2026-11-30']]);
      expect(nextQueuedQuestion(ids[51], answered, snoozes, today)).toBeNull();
      expect(nextQueuedQuestion(null, answered, snoozes, today)).toBeNull();
      expect(nextQueuedQuestion(null, answered, snoozes, '2026-11-23')?.id).toBe(ids[50]);
    });

    it('brings back a set-aside question only while its theme is chosen', () => {
      const snoozes = new Map([['migration-journey', '2026-10-26']]);
      expect(nextQueuedQuestion(ids[0], new Set(), snoozes, today)?.id).toBe(ids[1]);
      expect(nextQueuedQuestion(ids[0], new Set(), snoozes, today, ['migration'])?.id).toBe('migration-journey');
    });
  });
});
