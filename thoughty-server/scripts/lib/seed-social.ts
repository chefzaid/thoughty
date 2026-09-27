/**
 * Sessions and social data for the development seed: extra refresh tokens,
 * feature requests with votes, follows, comment threads, and likes. Uses the
 * fixed seed user ids: test (1), maya (2), sam (3), and newbie (5).
 */
import { query } from './db';

const TEST = 1;
const MAYA = 2;
const SAM = 3;
const NEWBIE = 5;
const WRITERS = [TEST, MAYA, SAM];
const THREADED_ENTRIES_PER_WRITER = 5;
const COMMENT_LINES = [
    'This one stayed with me all day.',
    'Same here. Thanks for sharing it.',
    'Beautifully put.',
    'I needed to read this today.',
    'The last line made me stop and think.',
    'I have been circling the same question lately.',
    'Saving this one for a slower morning.',
    'You put words to something I could not name.',
    'Such a gentle way to look at it.',
    'This made me want to go for a walk.',
    'Reading this with my coffee. Perfect timing.',
    'I love how honest this is.',
];

export async function insertSessionsAndSocialData(): Promise<void> {
    // Two sessions on other devices so "Sign out other sessions" has something to revoke.
    for (const [daysAgo, label] of [[3, 'laptop'], [12, 'phone']] as const) {
        await query('INSERT INTO refresh_tokens (user_id, token, expires_at, created_at) VALUES ($1, $2, $3, $4)', [
            TEST,
            `seed-session-${label}`,
            new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000),
        ]);
    }

    const requests: Array<[number, string, string, 'open' | 'reviewing' | 'planned', number[]]> = [
        [2, 'Dark mode for the printable book', 'The PDF book always prints on white. A dark cover and paper option would be lovely.', 'open', [1, 2, 3]],
        [3, 'Mood tracking with a daily slider', 'Let me rate my mood from 1 to 10 on each entry and chart it over time.', 'planned', [1, 2, 3, 5]],
        [1, 'Reminders to write at a set time', 'A gentle notification in the evening if I have not written yet.', 'reviewing', [1, 3]],
        [2, 'Export a single entry as an image', 'For sharing a quote from my journal on social media.', 'open', [2]],
        [3, 'Spanish translation', 'Would love to use Thoughty in Spanish.', 'open', [3, 5]],
        [5, 'Onboarding tips for new journalers', 'I just started and would like a few prompts to get going.', 'open', [5]],
    ];
    for (const [userId, title, details, status, voters] of requests) {
        const [row] = await query<{ id: number }>(
            'INSERT INTO feature_requests (user_id, title, details, status) VALUES ($1, $2, $3, $4) RETURNING id',
            [userId, title, details, status],
        );
        for (const voter of voters) {
            await query('INSERT INTO feature_request_votes (feature_request_id, user_id) VALUES ($1, $2)', [row.id, voter]);
        }
    }

    // test follows maya and sam, who follow test back; newbie follows two writers, maya follows sam.
    const follows = [[TEST, MAYA], [TEST, SAM], [MAYA, TEST], [SAM, TEST], [NEWBIE, TEST], [NEWBIE, MAYA], [MAYA, SAM]];
    for (const [followerId, followedId] of follows) {
        await query('INSERT INTO user_follows (follower_id, followed_id) VALUES ($1, $2)', [followerId, followedId]);
    }

    // Threads and likes under each writer's newest feed entries: enough for the leaderboard to rank
    // several entries and for test to earn the comment and like badges.
    const recentPublic = await query<{ id: number; user_id: number; rank: string }>(
        `SELECT id, user_id, rank FROM (
             SELECT id, user_id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rank
             FROM entries
             WHERE user_id = ANY($1) AND visibility = 'public' AND moderation_status = 'visible' AND NOT is_archived
         ) ranked
         WHERE rank <= $2
         ORDER BY user_id, rank`,
        [WRITERS, THREADED_ENTRIES_PER_WRITER],
    );
    let line = 0;
    for (const entry of recentPublic) {
        const rank = Number(entry.rank);
        const others = WRITERS.filter((userId) => userId !== entry.user_id);
        // Newest entries draw extra voices, so counts differ between entries.
        const commenters = rank === 1 ? [...others, NEWBIE] : others;
        for (const userId of commenters) {
            await query('INSERT INTO entry_comments (entry_id, user_id, content) VALUES ($1, $2, $3)', [
                entry.id,
                userId,
                COMMENT_LINES[line++ % COMMENT_LINES.length],
            ]);
        }
        if (rank === 1) {
            // The author's own reply shows in the thread but never counts toward rankings or karma.
            await query('INSERT INTO entry_comments (entry_id, user_id, content) VALUES ($1, $2, $3)', [
                entry.id,
                entry.user_id,
                'Thank you all for reading.',
            ]);
        }
        const likers = rank % 2 === 1 ? [...others, NEWBIE] : others;
        for (const userId of likers) {
            await query('INSERT INTO entry_likes (entry_id, user_id) VALUES ($1, $2)', [entry.id, userId]);
        }
    }

    // Authors like the comments other people left on their entries.
    await query(
        `INSERT INTO comment_likes (comment_id, user_id)
         SELECT c.id, e.user_id FROM entry_comments c JOIN entries e ON e.id = c.entry_id
         WHERE c.user_id <> e.user_id`,
    );
}
