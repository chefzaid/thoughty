#!/usr/bin/env ts-node
/**
 * Development database seed.
 *
 * Creates a journal that exercises every feature: daily entries since 2016
 * (one to four per day) across five diaries, cross-references and backlinks,
 * Markdown, favorites, pins, archive, revisions, attachments, AI chat
 * history, planted duplicates, tag metadata (including unused tags),
 * templates, extra sessions, community users for the public feed (with
 * moderated, archived, and deleted-author content), follows and comments
 * between test and the community users, an unverified user, and feature
 * requests with votes.
 *
 * Every account uses the password Test1234!. The content is deterministic.
 * Run with --validate-only to check the data without touching the database.
 *
 * With --into-user=<username>, only the main journal is added to that existing
 * account (which must have no entries yet): no users, settings, sessions, or
 * community data are created, changed, or deleted, and existing diaries with
 * the same name are reused.
 *
 * With --community-only, only the community accounts (maya, sam, and the
 * deleted leo) and their journals are added, with database-assigned ids and no
 * password, so nobody can sign in as them. It refuses if any of those usernames
 * or emails already exist and never changes existing users.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as bcrypt from 'bcryptjs';
import { query, closeDatabase, withTransaction } from './lib/db';
import { log, banner, section, summaryBox, fmt, table } from './lib/logger';
import { createRng, TAG_METADATA } from './lib/seed-content';
import {
    buildCommunityJournal,
    buildMainJournal,
    toIsoDate,
    type DiaryKey,
    type HandwrittenEntry,
    type SeedEntry,
} from './lib/seed-journal';
import { createAssetUploader, createSeedAsset } from './lib/seed-assets';

const JOURNAL_TEST_DATA_FILE = path.join(__dirname, '..', 'data', 'journal_test_data.txt');
const DREAMS_TEST_DATA_FILE = path.join(__dirname, '..', 'data', 'dreams_test_data.txt');
const REFERENCE_PATTERNS = [
    /\[\[(\d{4}-\d{2}-\d{2})(?:#(\d+))?\]\]/g,
    /entry \((\d{4}-\d{2}-\d{2})(?:--(\d+))?\)/g,
];
const validateOnlyFlag = process.argv.includes('--validate-only');
/** --into-user=<username>: add the main journal to an existing account without touching any user or setting. */
const intoUser = process.argv.find((arg) => arg.startsWith('--into-user='))?.slice('--into-user='.length);
/** --community-only: add only the public community accounts (maya, sam, leo), passwordless, next to existing users. */
const communityOnly = process.argv.includes('--community-only');
const PASSWORD = 'Test1234!';

interface SeedUser {
    id: number;
    username: string;
    email: string;
    verified: boolean;
    deleted?: boolean;
    diaries: Array<{ key: DiaryKey; name: string; icon: string; color: string; visibility: 'public' | 'private'; isDefault?: boolean }>;
    settings: Record<string, string>;
}

const MAIN_USER: SeedUser = {
    id: 1,
    username: 'test',
    email: 'test@example.com',
    verified: true,
    diaries: [
        { key: 'thoughts', name: 'Thoughts', icon: '💭', color: '#7C3AED', visibility: 'private', isDefault: true },
        { key: 'work', name: 'Work', icon: '💼', color: '#2563EB', visibility: 'private' },
        { key: 'dreams', name: 'Dreams', icon: '🌙', color: '#0891B2', visibility: 'private' },
        { key: 'travel', name: 'Travel', icon: '✈️', color: '#EA580C', visibility: 'public' },
        { key: 'gratitude', name: 'Gratitude', icon: '🙏', color: '#DB2777', visibility: 'private' },
    ],
    settings: {
        name: 'Alex Martin',
        bio: 'Writing one entry a day since 2016. Runner, reader, parent of two.',
        birthday: '1994-03-14',
        gender: 'other',
        theme: 'dark',
        language: 'en',
        entriesPerPage: '10',
        maxPinnedEntries: '3',
        defaultVisibility: 'private',
        readDates: 'true',
        autoTagMaxTags: '0',
        subscriptionPlan: 'plus',
        paymentMethodLabel: 'Visa ending in 4242',
        tagMetadata: JSON.stringify(TAG_METADATA),
        entryTemplates: JSON.stringify([
            { id: 'custom-seed-1', name: 'Run log', content: 'Distance:\nTime:\nHow it felt:\n', tags: ['running'], visibility: 'private', format: 'plain' },
            { id: 'custom-seed-2', name: 'Book notes', content: '## Book\n\n## Key ideas\n- \n\n## Quote\n> ', tags: ['books'], visibility: 'private', format: 'markdown' },
        ]),
    },
};

const COMMUNITY_USERS: SeedUser[] = [
    { id: 2, username: 'maya', email: 'maya@example.com', verified: true, diaries: [{ key: 'notes', name: 'Notes', icon: '📝', color: '#059669', visibility: 'public', isDefault: true }], settings: { name: 'Maya Chen', theme: 'light' } },
    { id: 3, username: 'sam', email: 'sam@example.com', verified: true, diaries: [{ key: 'notes', name: 'Journal', icon: '📓', color: '#CA8A04', visibility: 'public', isDefault: true }], settings: { name: 'Sam Rivera' } },
    { id: 4, username: 'leo', email: 'leo@example.com', verified: true, deleted: true, diaries: [{ key: 'notes', name: 'Journal', icon: '📓', color: '#6B7280', visibility: 'public', isDefault: true }], settings: {} },
];

const NEW_USER: SeedUser = {
    id: 5,
    username: 'newbie',
    email: 'newbie@example.com',
    verified: false,
    diaries: [{ key: 'notes', name: 'My Journal', icon: '📔', color: '#7C3AED', visibility: 'private', isDefault: true }],
    settings: {},
};

const ALL_USERS = [MAIN_USER, ...COMMUNITY_USERS, NEW_USER];

// ---------------------------------------------------------------------------
// Hand-written story entries (data/*.txt)
// Format: ---YYYY-MM-DD--[tags] starts a day, ---N--[tags] adds entry N that day.
// ---------------------------------------------------------------------------

function parseTestData(content: string): HandwrittenEntry[] {
    const entries: HandwrittenEntry[] = [];
    const lines = content.split('\n');
    let currentDate: string | null = null;
    let i = 0;

    while (i < lines.length) {
        const line = lines[i].trim();
        const dateMatch = /^---(\d{4}-\d{2}-\d{2})--\[([^\]]*)\]$/.exec(line);
        const numberMatch = /^---(\d+)--\[([^\]]*)\]$/.exec(line);
        if (!dateMatch && !(numberMatch && currentDate)) {
            i++;
            continue;
        }
        if (dateMatch) currentDate = dateMatch[1];
        const index = dateMatch ? entries.filter((entry) => entry.date === currentDate).length + 1 : Number.parseInt(numberMatch![1], 10);
        const tags = (dateMatch ? dateMatch[2] : numberMatch![2]).split(',').map((tag) => tag.trim()).filter(Boolean);

        const contentLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('---') && !lines[i].trim().startsWith('*****')) {
            if (lines[i].trim()) contentLines.push(lines[i].trim());
            i++;
        }
        if (contentLines.length > 0) {
            entries.push({ date: currentDate!, index, tags, content: contentLines.join('\n') });
        }
    }
    return entries;
}

function loadHandwritten(filePath: string): HandwrittenEntry[] {
    if (!fs.existsSync(filePath)) throw new Error(`Seed data file not found: ${filePath}`);
    return parseTestData(fs.readFileSync(filePath, 'utf-8'));
}

/** Every [[date#n]] or entry (date--n) reference must point at an entry in the same diary. */
function findBrokenReferences(entries: Array<{ diary?: string; date: string; index: number; content: string }>): string[] {
    const existing = new Set(entries.map((entry) => `${entry.diary ?? ''}|${entry.date}#${entry.index}`));
    const broken: string[] = [];
    for (const entry of entries) {
        for (const pattern of REFERENCE_PATTERNS) {
            for (const match of entry.content.matchAll(pattern)) {
                const target = `${entry.diary ?? ''}|${match[1]}#${match[2] ?? '1'}`;
                if (!existing.has(target)) broken.push(`${entry.date}#${entry.index} -> ${match[0]}`);
            }
        }
    }
    return broken;
}

// ---------------------------------------------------------------------------
// Database writes
// ---------------------------------------------------------------------------

async function resetUsers(): Promise<void> {
    const ids = ALL_USERS.map((user) => user.id);
    const names = ALL_USERS.map((user) => user.username);
    const emails = ALL_USERS.map((user) => user.email);
    await query('DELETE FROM users WHERE id = ANY($1) OR username = ANY($2) OR email = ANY($3)', [ids, names, emails]);
}

async function insertUsers(): Promise<void> {
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    for (const user of ALL_USERS) {
        await query(
            `INSERT INTO users (id, username, email, password_hash, auth_provider, email_verified, deleted_at, deletion_reason, created_at)
             VALUES ($1, $2, $3, $4, 'local', $5, $6, $7, $8)`,
            [
                user.id,
                user.username,
                user.email,
                passwordHash,
                user.verified,
                user.deleted ? new Date() : null,
                user.deleted ? 'Seeded deleted account' : null,
                user.id === MAIN_USER.id ? new Date('2016-01-01T08:00:00Z') : new Date('2023-01-01T08:00:00Z'),
            ],
        );
        for (const [key, value] of Object.entries(user.settings)) {
            await query('INSERT INTO settings (user_id, key, value) VALUES ($1, $2, $3)', [user.id, key, value]);
        }
    }
    await query(`SELECT setval(pg_get_serial_sequence('users', 'id'), GREATEST((SELECT MAX(id) FROM users), 1))`);
}

async function insertCommunityAccounts(communityEntries: Map<number, SeedEntry[]>): Promise<number> {
    const names = COMMUNITY_USERS.map((user) => user.username);
    const emails = COMMUNITY_USERS.map((user) => user.email);
    const conflicts = await query<{ username: string }>('SELECT username FROM users WHERE username = ANY($1) OR email = ANY($2)', [names, emails]);
    if (conflicts.length > 0) {
        throw new Error(`Community accounts already exist (${conflicts.map((row) => row.username).join(', ')}); refusing to add them again`);
    }

    let inserted = 0;
    for (const user of COMMUNITY_USERS) {
        const [row] = await query<{ id: number }>(
            `INSERT INTO users (username, email, password_hash, auth_provider, email_verified, deleted_at, deletion_reason)
             VALUES ($1, $2, NULL, 'local', true, $3, $4) RETURNING id`,
            [user.username, user.email, user.deleted ? new Date() : null, user.deleted ? 'Seeded deleted account' : null],
        );
        for (const [key, value] of Object.entries(user.settings)) {
            await query('INSERT INTO settings (user_id, key, value) VALUES ($1, $2, $3)', [row.id, key, value]);
        }
        const diaries = await insertDiaries({ ...user, id: row.id });
        const entries = communityEntries.get(user.id) ?? [];
        await insertEntries(row.id, diaries, entries);
        inserted += entries.length;
    }
    return inserted;
}

async function insertDiaries(user: SeedUser): Promise<Map<DiaryKey, number>> {
    const ids = new Map<DiaryKey, number>();
    for (const [position, diary] of user.diaries.entries()) {
        const [row] = await query<{ id: number }>(
            `INSERT INTO diaries (user_id, name, icon, color, visibility, is_default, position)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [user.id, diary.name, diary.icon, diary.color, diary.visibility, Boolean(diary.isDefault), position],
        );
        ids.set(diary.key, row.id);
    }
    return ids;
}

async function resolveExistingAccount(username: string): Promise<{ userId: number; diaries: Map<DiaryKey, number> }> {
    const [user] = await query<{ id: number; deleted_at: Date | null }>('SELECT id, deleted_at FROM users WHERE username = $1', [username]);
    if (!user) throw new Error(`No user named ${username}`);
    if (user.deleted_at) throw new Error(`User ${username} is deleted`);
    const [{ count }] = await query<{ count: string }>('SELECT COUNT(*) AS count FROM entries WHERE user_id = $1', [user.id]);
    if (Number(count) > 0) throw new Error(`User ${username} already has ${count} entries; refusing to add the seed journal`);

    const existing = await query<{ id: number; name: string; position: number }>('SELECT id, name, position FROM diaries WHERE user_id = $1', [user.id]);
    const diaries = new Map<DiaryKey, number>();
    let position = Math.max(-1, ...existing.map((diary) => diary.position ?? 0));
    for (const diary of MAIN_USER.diaries) {
        const match = existing.find((candidate) => candidate.name.toLowerCase() === diary.name.toLowerCase());
        if (match) {
            diaries.set(diary.key, match.id);
            continue;
        }
        position += 1;
        const [row] = await query<{ id: number }>(
            `INSERT INTO diaries (user_id, name, icon, color, visibility, is_default, position)
             VALUES ($1, $2, $3, $4, $5, false, $6) RETURNING id`,
            [user.id, diary.name, diary.icon, diary.color, diary.visibility, position],
        );
        diaries.set(diary.key, row.id);
    }
    return { userId: user.id, diaries };
}

const ENTRY_COLUMNS = ['user_id', 'diary_id', 'date', '"index"', 'tags', 'content', 'format', 'visibility', 'moderation_status', 'is_favorite', 'is_archived', 'is_pinned', 'created_at', 'updated_at'];

async function insertEntries(userId: number, diaries: Map<DiaryKey, number>, entries: SeedEntry[]): Promise<Map<SeedEntry, number>> {
    const ids = new Map<SeedEntry, number>();
    for (let start = 0; start < entries.length; start += 400) {
        const batch = entries.slice(start, start + 400);
        const values: unknown[] = [];
        const rows = batch.map((entry, row) => {
            values.push(userId, diaries.get(entry.diary), entry.date, entry.index, entry.tags, entry.content, entry.format, entry.visibility,
                entry.moderationStatus, entry.isFavorite, entry.isArchived, entry.isPinned, entry.createdAt, entry.updatedAt);
            return `(${ENTRY_COLUMNS.map((_, column) => `$${row * ENTRY_COLUMNS.length + column + 1}`).join(', ')})`;
        });
        const inserted = await query<{ id: number }>(`INSERT INTO entries (${ENTRY_COLUMNS.join(', ')}) VALUES ${rows.join(', ')} RETURNING id`, values);
        inserted.forEach((row, i) => ids.set(batch[i], row.id));
    }
    return ids;
}

async function insertEntryExtras(userId: number, entries: SeedEntry[], ids: Map<SeedEntry, number>): Promise<{ revisions: number; chats: number; attachments: number; attachmentsSkipped: boolean }> {
    let revisions = 0;
    let chats = 0;
    let attachments = 0;
    const upload = entries.some((entry) => entry.attachment) ? await createAssetUploader(process.env) : null;

    for (const entry of entries) {
        const entryId = ids.get(entry)!;
        for (const revision of entry.revisions) {
            await query(
                'INSERT INTO entry_revisions (entry_id, user_id, content, tags, date, format, visibility, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [entryId, userId, revision.content, revision.tags.join(','), entry.date, entry.format, entry.visibility, revision.createdAt],
            );
            revisions++;
        }
        if (entry.chat) {
            await query('INSERT INTO ai_chat_histories (user_id, entry_id, messages) VALUES ($1, $2, $3)', [userId, entryId, JSON.stringify(entry.chat)]);
            chats++;
        }
        if (entry.attachment && upload) {
            const asset = createSeedAsset(entry.attachment);
            const storedFilename = await upload(asset);
            await query(
                `INSERT INTO attachments (user_id, entry_id, original_filename, stored_filename, mimetype, size, transcript, transcribed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [userId, entryId, asset.originalFilename, storedFilename, asset.mimetype, asset.body.length, asset.transcript ?? null, asset.transcript ? new Date() : null],
            );
            attachments++;
        }
    }
    return { revisions, chats, attachments, attachmentsSkipped: !upload && entries.some((entry) => entry.attachment) };
}

async function insertSessionsAndSocialData(): Promise<void> {
    // Two sessions on other devices so "Sign out other sessions" has something to revoke.
    for (const [daysAgo, label] of [[3, 'laptop'], [12, 'phone']] as const) {
        await query('INSERT INTO refresh_tokens (user_id, token, expires_at, created_at) VALUES ($1, $2, $3, $4)', [
            MAIN_USER.id,
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
    for (const [followerId, followedId] of [[1, 2], [1, 3], [2, 1], [3, 1]]) {
        await query('INSERT INTO user_follows (follower_id, followed_id) VALUES ($1, $2)', [followerId, followedId]);
    }

    // A short thread under the newest feed entry of test and of maya, so both commenting and
    // the entry owner's right to delete other people's comments can be tried.
    const threads: Record<number, Array<[number, string]>> = {
        1: [[2, 'This one stayed with me all day.'], [3, 'Same here. Thanks for sharing it.']],
        2: [[1, 'Beautifully put.'], [3, 'I needed to read this today.']],
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
}

function buildCommunityEntries(today: string): Map<number, SeedEntry[]> {
    const maya = buildCommunityJournal(createRng(2), today, '2023-01-01', 4, 0.85);
    const sam = buildCommunityJournal(createRng(3), today, '2025-01-01', 6, 0.9);
    const leo = buildCommunityJournal(createRng(4), today, '2025-06-01', 10, 1);
    // Sam's journal covers every moderation state and archived public entries.
    const samPublic = sam.filter((entry) => entry.visibility === 'public');
    samPublic.slice(0, 3).forEach((entry) => { entry.moderationStatus = 'hidden'; });
    samPublic.slice(3, 6).forEach((entry) => { entry.moderationStatus = 'under_review'; });
    samPublic.slice(6, 8).forEach((entry) => { entry.moderationStatus = 'removed'; });
    samPublic.slice(8, 11).forEach((entry) => { entry.isArchived = true; });
    return new Map([[2, maya], [3, sam], [4, leo]]);
}

async function seed(): Promise<void> {
    const startTime = Date.now();
    banner('DATABASE SEEDER', 'Populating the development database');

    try {
        section('Building Journal');
        const today = toIsoDate(new Date());
        const handwritten = { thoughts: loadHandwritten(JOURNAL_TEST_DATA_FILE), dreams: loadHandwritten(DREAMS_TEST_DATA_FILE) };
        const mainEntries = buildMainJournal(createRng(1), today, handwritten);
        const communityEntries = buildCommunityEntries(today);
        const communityCount = [...communityEntries.values()].reduce((sum, entries) => sum + entries.length, 0);
        log.success(`Planned ${fmt.bold(String(mainEntries.length))} entries for ${MAIN_USER.username} and ${communityCount} for community users`);

        section('Validating');
        const broken = findBrokenReferences(mainEntries);
        if (broken.length > 0) throw new Error(`Found ${broken.length} broken cross-reference(s):\n  ${broken.slice(0, 20).join('\n  ')}`);
        const duplicateKeys = mainEntries.length - new Set(mainEntries.map((entry) => `${entry.diary}|${entry.date}#${entry.index}`)).size;
        if (duplicateKeys > 0) throw new Error(`Found ${duplicateKeys} entries sharing a diary, date, and index`);
        log.success('Cross-references and entry coordinates are valid');

        if (validateOnlyFlag) {
            summaryBox('Seed Validation Complete', [
                ['Entries (main user)', String(mainEntries.length)],
                ['Entries (community)', String(communityCount)],
                ['Date range', `${mainEntries.reduce((min, entry) => (entry.date < min ? entry.date : min), today)} to ${today}`],
                ['Cross-references', 'Valid'],
            ]);
            process.exit(0);
        }

        section('Writing Database');
        if (communityOnly) {
            const inserted = await withTransaction(() => insertCommunityAccounts(communityEntries));
            summaryBox('Community Seed Complete', [
                ['Accounts', COMMUNITY_USERS.map((user) => user.username + (user.deleted ? ' (deleted)' : '')).join(', ')],
                ['Entries', String(inserted)],
                ['Sign-in', 'disabled (no password)'],
                ['Duration', `${Date.now() - startTime}ms`],
            ]);
            await closeDatabase();
            process.exit(0);
        }
        const targetUserId = await withTransaction(async () => {
            let userId = MAIN_USER.id;
            let diaries: Map<DiaryKey, number>;
            if (intoUser) {
                log.step(`Adding the journal to the existing account ${intoUser}...`);
                ({ userId, diaries } = await resolveExistingAccount(intoUser));
            } else {
                log.step('Resetting seed accounts...');
                await resetUsers();
                await insertUsers();
                log.success(`Created ${ALL_USERS.length} users (password ${PASSWORD})`);
                diaries = await insertDiaries(MAIN_USER);
            }

            log.step(`Inserting ${mainEntries.length} entries...`);
            const ids = await insertEntries(userId, diaries, mainEntries);
            const extras = await insertEntryExtras(userId, mainEntries, ids);
            log.success(`Inserted entries with ${extras.revisions} revisions, ${extras.chats} chat histories, ${extras.attachments} attachments`);
            if (extras.attachmentsSkipped) log.warning('Object storage is unreachable; attachments were skipped');

            if (!intoUser) {
                for (const user of [...COMMUNITY_USERS, NEW_USER]) {
                    const userDiaries = await insertDiaries(user);
                    await insertEntries(user.id, userDiaries, communityEntries.get(user.id) ?? []);
                }
                await insertSessionsAndSocialData();
                log.success('Inserted community journals, sessions, follows, comments, and feature requests');
            }
            return userId;
        });

        section('Summary');
        const perDiary = await query<{ name: string; entries: string; first: Date; last: Date }>(
            `SELECT d.name, COUNT(e.id) AS entries, MIN(e.date) AS first, MAX(e.date) AS last
             FROM diaries d LEFT JOIN entries e ON e.diary_id = d.id
             WHERE d.user_id = $1 GROUP BY d.name, d.position ORDER BY d.position`,
            [targetUserId],
        );
        table(['Diary', 'Entries', 'From', 'To'], perDiary.map((row) => [row.name, row.entries, toIsoDate(new Date(row.first)), toIsoDate(new Date(row.last))]));
        const [tagCount] = await query<{ count: string }>('SELECT COUNT(DISTINCT tag) AS count FROM entries, unnest(tags) AS tag WHERE user_id = $1', [targetUserId]);
        const count = (predicate: (entry: SeedEntry) => boolean) => String(mainEntries.filter(predicate).length);

        summaryBox('Seed Complete', [
            ['Account', intoUser ?? `${MAIN_USER.username} or ${MAIN_USER.email} / ${PASSWORD}`],
            ['Entries', String(mainEntries.length)],
            ['Tags in use', tagCount.count],
            ['Markdown', count((entry) => entry.format === 'markdown')],
            ['Cross-referencing', count((entry) => /\[\[\d{4}-|entry \(\d{4}-/.test(entry.content))],
            ['Public / favorite / pinned / archived', `${count((e) => e.visibility === 'public')} / ${count((e) => e.isFavorite)} / ${count((e) => e.isPinned)} / ${count((e) => e.isArchived)}`],
            ['Other users', intoUser ? 'none (existing accounts untouched)' : 'maya, sam (moderated), leo (deleted), newbie (unverified)'],
            ['Duration', `${Date.now() - startTime}ms`],
        ]);

        await closeDatabase();
        process.exit(0);
    } catch (err) {
        log.error(`Seeding failed: ${(err as Error).message}`);
        console.error(err);
        await closeDatabase();
        process.exit(1);
    }
}

seed();
