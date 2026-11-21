import { describe, expect, it } from 'vitest';

import { memoirChapters, memoirChaptersWith, memoirProgram } from '../../test/memoirFixture';
import { pickSimpleMemoirView } from './simpleMemoirView';

describe('pickSimpleMemoirView', () => {
  it('asks this week’s question while it is unanswered', () => {
    const view = pickSimpleMemoirView(memoirProgram, memoirChapters, null);
    expect(view).toMatchObject({ kind: 'ask', question: { id: 'childhood-home' }, chapter: { id: 'childhood' } });
  });

  it('asks the question a link names first, while it is unanswered', () => {
    expect(pickSimpleMemoirView(memoirProgram, memoirChapters, 'work-path')).toMatchObject({ kind: 'ask', question: { id: 'work-path' }, chapter: { id: 'work' } });
    // An answered or unknown one gives way to this week's
    expect(pickSimpleMemoirView(memoirProgram, memoirChapters, 'childhood-play')).toMatchObject({ question: { id: 'childhood-home' } });
    expect(pickSimpleMemoirView(memoirProgram, memoirChapters, 'nope')).toMatchObject({ question: { id: 'childhood-home' } });
  });

  it('says when this week’s question is answered', () => {
    expect(pickSimpleMemoirView(memoirProgram, memoirChaptersWith({ 'childhood-home': 90 }), null)).toEqual({ kind: 'answered' });
  });

  it('says when every question left is set aside, with the first day one comes back, or when all are answered', () => {
    const away = memoirChaptersWith({}, { 'childhood-home': '2026-11-30', 'work-path': '2026-11-23' });
    expect(pickSimpleMemoirView({ ...memoirProgram, currentQuestionId: null }, away, null)).toEqual({ kind: 'setAside', returnDay: '2026-11-23' });
    const done = memoirChaptersWith({ 'childhood-home': 90, 'work-path': 91 });
    expect(pickSimpleMemoirView({ ...memoirProgram, currentQuestionId: null }, done, null)).toEqual({ kind: 'complete' });
  });

  it('asks nothing while the memoir has no diary', () => {
    expect(pickSimpleMemoirView({ ...memoirProgram, diaryId: null }, memoirChapters, 'work-path')).toEqual({ kind: 'noDiary' });
  });
});
