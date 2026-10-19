/**
 * Guided memoir for the development seed: a "My memoir" diary for test (1)
 * with five answered questions across three chapters, weekly emails on
 * Sundays in Paris time, and the next unanswered question as this week's.
 */
import { composeAnswerContent } from '../../src/modules/memoir/memoir-content';
import { findMemoirChapter, findMemoirQuestion, nextUnansweredQuestion } from '../../src/modules/memoir/memoir-questions';
import { nextWeeklyDelivery } from '../../src/modules/memoir/memoir-schedule';
import { query } from './db';
import { toIsoDate } from './seed-journal';

const TEST = 1;
const TIME_ZONE = 'Europe/Paris';
const DAY_MS = 24 * 60 * 60 * 1000;

const ANSWERS: ReadonlyArray<[questionId: string, daysAgo: number, answer: string]> = [
    ['childhood-home', 35, 'A narrow stone house at the end of a lane. The kitchen smelled of bread on Saturdays, the stairs creaked on the third step, and in summer the fig tree outside my window hummed with wasps.'],
    ['childhood-earliest-memory', 28, 'Sitting on my grandfather\'s shoulders at the harbour, watching the boats come in. I remember his hat more than the boats. I think it stayed because it is the first time I felt very tall and very safe at once.'],
    ['childhood-play', 21, 'Marbles in the schoolyard, and long evenings of hide and seek with the neighbours\' kids until someone\'s mother called us in. My best hiding place was the empty rain barrel.'],
    ['family-parents', 14, 'My mother was the planner and my father the storyteller. From her I learned to finish what I start; from him, that a good story is worth being late for.'],
    ['places-journey', 7, 'The night train to Lisbon when I was twenty. Strangers shared their food, nobody spoke the same language, and I understood that kindness does not need translation.'],
];

export async function insertMemoir(): Promise<number> {
    const now = new Date();
    const [diary] = await query<{ id: number }>(
        `INSERT INTO diaries (user_id, name, icon, color, visibility, is_default, position)
         VALUES ($1, 'My memoir', '📖', '#B45309', 'private', false, (SELECT COALESCE(MAX(position), -1) + 1 FROM diaries WHERE user_id = $1))
         RETURNING id`,
        [TEST],
    );

    for (const [questionId, daysAgo, answer] of ANSWERS) {
        const question = findMemoirQuestion(questionId);
        const chapter = question && findMemoirChapter(question.chapterId);
        if (!question || !chapter) throw new Error(`Unknown memoir question ${questionId}`);

        const answeredAt = new Date(now.getTime() - daysAgo * DAY_MS);
        const date = toIsoDate(answeredAt);
        const [{ next }] = await query<{ next: number }>(
            'SELECT COALESCE(MAX("index"), 0) + 1 AS next FROM entries WHERE user_id = $1 AND date = $2',
            [TEST, date],
        );
        const [entry] = await query<{ id: number }>(
            `INSERT INTO entries (user_id, diary_id, date, "index", tags, content, format, visibility, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, 'markdown', 'private', $7, $7) RETURNING id`,
            [TEST, diary.id, date, next, [chapter.title.en], composeAnswerContent(question.text.en, answer), answeredAt],
        );
        await query('INSERT INTO memoir_answers (user_id, question_id, entry_id, created_at) VALUES ($1, $2, $3, $4)', [
            TEST,
            questionId,
            entry.id,
            answeredAt,
        ]);
    }

    const answered = new Set(ANSWERS.map(([questionId]) => questionId));
    const current = nextUnansweredQuestion(ANSWERS[ANSWERS.length - 1][0], answered);
    await query(
        `INSERT INTO memoir_programs (user_id, diary_id, status, email_enabled, delivery_weekday, time_zone,
                                      current_question_id, current_question_at, next_delivery_at, created_at)
         VALUES ($1, $2, 'active', true, 0, $3, $4, $5, $6, $7)`,
        [TEST, diary.id, TIME_ZONE, current?.id ?? null, now, nextWeeklyDelivery(now, 0, TIME_ZONE), new Date(now.getTime() - 36 * DAY_MS)],
    );
    return ANSWERS.length;
}
