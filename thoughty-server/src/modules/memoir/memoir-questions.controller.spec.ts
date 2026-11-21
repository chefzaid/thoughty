import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { MemoirQuestionsController } from './memoir-questions.controller';
import { MEMOIR_CHAPTERS, MEMOIR_QUESTIONS } from './memoir-questions';

describe('MemoirQuestionsController', () => {
  const controller = new MemoirQuestionsController();

  it('lists every chapter and question in life order, in both languages, without an account', () => {
    const { chapters } = controller.list();

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, MemoirQuestionsController.prototype.list)).toBe(true);
    expect(chapters.map((chapter) => chapter.id)).toEqual(MEMOIR_CHAPTERS.map((chapter) => chapter.id));
    expect(chapters.flatMap((chapter) => chapter.questions.map((question) => question.id)))
      .toEqual(MEMOIR_QUESTIONS.map((question) => question.id));
    expect(chapters[0]).toMatchObject({ id: 'childhood', title: { en: 'Childhood', fr: 'Enfance' }, theme: false });
    expect(chapters[0].questions[0]).toEqual({
      id: 'childhood-home',
      text: {
        en: 'What did the home you grew up in look, sound, and smell like?',
        fr: 'À quoi ressemblait la maison de votre enfance : ses pièces, ses bruits, ses odeurs ?',
      },
    });
  });

  it('marks the themed chapters and keeps the year at 52 questions', () => {
    const { chapters } = controller.list();
    const year = chapters.filter((chapter) => !chapter.theme).flatMap((chapter) => chapter.questions);

    expect(chapters.filter((chapter) => chapter.theme).map((chapter) => chapter.id))
      .toEqual(['parenthood', 'careers', 'migration', 'history', 'faith']);
    expect(year).toHaveLength(52);
  });
});
