import {
  MEMOIR_CHAPTERS,
  MEMOIR_QUESTIONS,
  findMemoirChapter,
  findMemoirQuestion,
  nextUnansweredQuestion,
  resolveMemoirLanguage,
} from './memoir-questions';

describe('memoir questions', () => {
  it('offers a year of weekly questions in life order, each in English and French', () => {
    expect(MEMOIR_QUESTIONS).toHaveLength(52);
    expect(MEMOIR_CHAPTERS.map((chapter) => chapter.id)).toEqual([
      'childhood',
      'growing-up',
      'family',
      'love',
      'work',
      'places',
      'lessons',
    ]);
    expect(new Set(MEMOIR_QUESTIONS.map((question) => question.id)).size).toBe(52);
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
    const ids = MEMOIR_QUESTIONS.map((question) => question.id);

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
  });
});
