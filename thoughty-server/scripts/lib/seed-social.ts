/**
 * Sessions and social data for the development seed: extra refresh tokens,
 * feature requests with votes, follows, comment threads, and likes. Uses the
 * fixed seed user ids: test (1), maya (2), sam (3), and newbie (5).
 */
import { query } from './db';

const TEST = 1;
const MAYA = 2;
const SAM = 3;

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

    // test follows maya and sam; maya and sam follow test back, so both follow lists have content.
    for (const [followerId, followedId] of [[TEST, MAYA], [TEST, SAM], [MAYA, TEST], [SAM, TEST]]) {
        await query('INSERT INTO user_follows (follower_id, followed_id) VALUES ($1, $2)', [followerId, followedId]);
    }

    // A short thread under the newest feed entry of test and of maya, so both commenting and
    // the entry owner's right to delete other people's comments can be tried.
    const threads: Record<number, Array<[number, string]>> = {
        [TEST]: [[MAYA, 'This one stayed with me all day.'], [SAM, 'Same here. Thanks for sharing it.']],
        [MAYA]: [[TEST, 'Beautifully put.'], [SAM, 'I needed to read this today.']],
    };
    const newestPublic = await query<{ id: number; user_id: number }>(
        `SELECT DISTINCT ON (user_id) id, user_id FROM entries
         WHERE user_id = ANY($1) AND visibility = 'public' AND moderation_status = 'visible' AND NOT is_archived
         ORDER BY user_id, created_at DESC, id DESC`,
        [Object.keys(threads).map(Number)],
    );
    for (const entry of newestPublic) {
        for (const [userId, content] of threads[entry.user_id]) {
            await query('INSERT INTO entry_comments (entry_id, user_id, content) VALUES ($1, $2, $3)', [entry.id, userId, content]);
        }
    }

    // Likes on both threaded entries (never by their own author), and maya liking test's comment.
    for (const entry of newestPublic) {
        const likers = entry.user_id === TEST ? [MAYA, SAM] : [TEST, SAM];
        for (const userId of likers) {
            await query('INSERT INTO entry_likes (entry_id, user_id) VALUES ($1, $2)', [entry.id, userId]);
        }
    }
    await query(
        `INSERT INTO comment_likes (comment_id, user_id)
         SELECT id, $1 FROM entry_comments WHERE user_id = $2`,
        [MAYA, TEST],
    );
}
