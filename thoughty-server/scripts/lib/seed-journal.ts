/**
 * Builds the development journal as plain data (no database access), so the
 * same seed always produces the same entries, references, and edge cases.
 */
import {
    DREAM_SENTENCES,
    TOPICS,
    TRAVEL_PLACES,
    TRAVEL_SENTENCES,
    WORK_DIARY_SENTENCES,
    YEAR_THEMES,
    between,
    chance,
    fill,
    pick,
    pickSome,
    type Rng,
} from './seed-content';

export type DiaryKey = 'thoughts' | 'dreams' | 'work' | 'travel' | 'gratitude' | 'notes';
export type AttachmentKind = 'image' | 'text' | 'pdf' | 'audio';

export interface HandwrittenEntry {
    date: string;
    index: number;
    tags: string[];
    content: string;
}

export interface SeedRevision {
    content: string;
    tags: string[];
    createdAt: Date;
}

export interface SeedEntry {
    diary: DiaryKey;
    date: string;
    index: number;
    tags: string[];
    content: string;
    format: 'plain' | 'markdown';
    visibility: 'public' | 'private';
    moderationStatus: 'visible' | 'hidden' | 'under_review' | 'removed';
    isFavorite: boolean;
    isArchived: boolean;
    isPinned: boolean;
    createdAt: Date;
    updatedAt: Date;
    revisions: SeedRevision[];
    chat?: Array<{ role: 'user' | 'assistant'; content: string }>;
    attachment?: AttachmentKind;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const toIsoDate = (date: Date): string => date.toISOString().slice(0, 10);
const parseIsoDate = (value: string): Date => new Date(`${value}T00:00:00Z`);
export const addDays = (value: string, days: number): string => toIsoDate(new Date(parseIsoDate(value).getTime() + days * DAY_MS));

export function eachDate(from: string, to: string): string[] {
    const dates: string[] = [];
    for (let date = from; date <= to; date = addDays(date, 1)) {
        dates.push(date);
    }
    return dates;
}

const weekday = (date: string): number => parseIsoDate(date).getUTCDay();

function sentencesFor(rng: Rng, topicKey: string, count: number): string[] {
    return pickSome(rng, TOPICS[topicKey].sentences, count).map((sentence) => fill(rng, sentence));
}

function paragraphs(sentences: string[], perParagraph: number): string {
    const blocks: string[] = [];
    for (let i = 0; i < sentences.length; i += perParagraph) {
        blocks.push(sentences.slice(i, i + perParagraph).join(' '));
    }
    return blocks.join('\n\n');
}

/** One generated journal entry: a primary topic, optional secondary topic, and the year's life theme. */
function composeEntry(rng: Rng, year: number): { content: string; tags: string[]; format: 'plain' | 'markdown' } {
    const theme = YEAR_THEMES[Math.min(Math.max(year, 2016), 2026)];
    const topicKeys = Object.keys(TOPICS);
    const primary = chance(rng, 0.45) ? pick(rng, theme.topics) : pick(rng, topicKeys);
    const secondary = chance(rng, 0.35) ? pick(rng, topicKeys.filter((key) => key !== primary)) : null;

    const tags = new Set(pickSome(rng, TOPICS[primary].tags, between(rng, 1, 2)));
    if (secondary) tags.add(pick(rng, TOPICS[secondary].tags));
    if (chance(rng, 0.3)) tags.add(theme.tag);

    const size = rng();
    let sentences: string[];
    if (size < 0.35) {
        sentences = sentencesFor(rng, primary, between(rng, 1, 2));
    } else if (size < 0.8) {
        sentences = [...sentencesFor(rng, primary, between(rng, 2, 3)), ...(secondary ? sentencesFor(rng, secondary, 1) : [])];
    } else if (size < 0.95) {
        sentences = [...sentencesFor(rng, primary, 4), ...(secondary ? sentencesFor(rng, secondary, 3) : []), pick(rng, theme.sentences)];
    } else {
        // Long-form reflection, useful for summaries and reading-time stats.
        sentences = [
            pick(rng, theme.sentences),
            ...sentencesFor(rng, primary, 6),
            ...sentencesFor(rng, 'philosophy', 4),
            ...(secondary ? sentencesFor(rng, secondary, 4) : []),
            ...sentencesFor(rng, 'mind', 3),
            ...sentencesFor(rng, 'growth', 3),
        ];
        tags.add('reflection');
    }
    if (chance(rng, 0.25)) sentences.unshift(pick(rng, theme.sentences));

    if (chance(rng, 0.18) && sentences.length >= 3) {
        const [first, ...rest] = sentences;
        const quote = fill(rng, pick(rng, TOPICS.philosophy.sentences));
        const content = [
            `## ${pick(rng, ['Today', 'Notes to self', 'Reflection', 'What happened', 'Thoughts'])}`,
            `**${first}**`,
            rest.map((sentence) => `- ${sentence}`).join('\n'),
            `> ${quote}`,
        ].join('\n\n');
        return { content, tags: [...tags], format: 'markdown' };
    }

    const perParagraph = sentences.length > 6 ? between(rng, 3, 5) : sentences.length;
    return { content: paragraphs(sentences, perParagraph), tags: [...tags], format: 'plain' };
}

function timestamp(rng: Rng, date: string): Date {
    return new Date(parseIsoDate(date).getTime() + between(rng, 6 * 60, 23 * 60 + 30) * 60 * 1000);
}

function baseEntry(rng: Rng, diary: DiaryKey, date: string, index: number, fields: Pick<SeedEntry, 'content' | 'tags' | 'format'>): SeedEntry {
    const createdAt = timestamp(rng, date);
    return {
        diary,
        date,
        index,
        ...fields,
        visibility: 'private',
        moderationStatus: 'visible',
        isFavorite: false,
        isArchived: false,
        isPinned: false,
        createdAt,
        updatedAt: createdAt,
        revisions: [],
    };
}

class EntryBook {
    readonly entries: SeedEntry[] = [];
    private readonly nextIndex = new Map<string, number>();

    add(rng: Rng, diary: DiaryKey, date: string, fields: Pick<SeedEntry, 'content' | 'tags' | 'format'>, index?: number): SeedEntry {
        const key = `${diary}|${date}`;
        const resolvedIndex = index ?? this.nextIndex.get(key) ?? 1;
        this.nextIndex.set(key, Math.max(this.nextIndex.get(key) ?? 1, resolvedIndex + 1));
        const entry = baseEntry(rng, diary, date, resolvedIndex, fields);
        this.entries.push(entry);
        return entry;
    }
}

const reference = (entry: SeedEntry, legacy: boolean): string => {
    if (legacy) return entry.index > 1 ? `entry (${entry.date}--${entry.index})` : `entry (${entry.date})`;
    return entry.index > 1 ? `[[${entry.date}#${entry.index}]]` : `[[${entry.date}]]`;
};

/** Links about 9% of entries to an earlier entry in the same diary, preferring a shared tag. */
function addCrossReferences(rng: Rng, entries: SeedEntry[]): void {
    const byDiary = new Map<DiaryKey, SeedEntry[]>();
    for (const entry of [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.index - b.index)) {
        const earlier = byDiary.get(entry.diary) ?? [];
        const alreadyLinked = /\[\[\d{4}-|entry \(\d{4}-/.test(entry.content);
        if (earlier.length > 30 && !alreadyLinked && entry.format === 'plain') {
            const oneYearAgo = earlier.find((candidate) => candidate.date === addDays(entry.date, -365) && candidate.index === 1);
            if (oneYearAgo && chance(rng, 0.02)) {
                entry.content += `\n\nOne year ago today I wrote ${reference(oneYearAgo, false)}. Funny how much has changed.`;
            } else if (chance(rng, 0.09)) {
                const related = earlier.filter((candidate) => candidate.tags.some((tag) => entry.tags.includes(tag)));
                const target = pick(rng, related.length > 0 ? related.slice(-200) : earlier);
                const legacy = chance(rng, 0.15);
                entry.content += `\n\n${pick(rng, [
                    `This reminds me of ${reference(target, legacy)}.`,
                    `Still thinking about what I wrote in ${reference(target, legacy)}.`,
                    `Compare with ${reference(target, legacy)}: I see it differently now.`,
                    `Following up on ${reference(target, legacy)}.`,
                ])}`;
            }
        }
        earlier.push(entry);
        byDiary.set(entry.diary, earlier);
    }
}

function addRevisions(rng: Rng, entries: SeedEntry[]): void {
    for (const entry of entries) {
        if (!chance(rng, 0.02) || entry.content.length < 80) continue;
        const count = between(rng, 1, 3);
        let draft = entry.content;
        for (let i = count; i >= 1; i--) {
            const sentences = draft.split(/(?<=[.!?])\s+/);
            draft = sentences.length > 1 ? sentences.slice(0, -1).join(' ') : `${draft} (first draft)`;
            entry.revisions.push({
                content: draft,
                tags: entry.tags.slice(0, Math.max(1, entry.tags.length - 1)),
                createdAt: new Date(entry.createdAt.getTime() + (count - i + 1) * 45 * 60 * 1000),
            });
        }
        entry.updatedAt = new Date(entry.createdAt.getTime() + (count + 1) * 45 * 60 * 1000);
    }
}

const CHAT_TURNS = [
    ['What pattern do you see in this entry?', 'You describe feeling pulled between what others expect and what you want. The entry ends on a decision, which suggests you already know which side matters more.'],
    ['Am I being too hard on myself here?', 'You hold yourself to a standard you would not apply to a friend. You might ask what you would tell them in the same situation.'],
    ['What question should I reflect on next?', 'What would it look like to act on this without waiting until you feel completely ready?'],
];

/** The main account: every day since 2016 in Thoughts, plus Work, Dreams, Travel, and Gratitude diaries. */
export function buildMainJournal(
    rng: Rng,
    today: string,
    handwritten: { thoughts: HandwrittenEntry[]; dreams: HandwrittenEntry[] },
): SeedEntry[] {
    const book = new EntryBook();
    const handwrittenByDate = new Map<string, HandwrittenEntry[]>();
    for (const entry of handwritten.thoughts) {
        handwrittenByDate.set(entry.date, [...(handwrittenByDate.get(entry.date) ?? []), entry]);
    }

    // Hand-written story entries (2015 onward) keep their own dates, indexes, and cross-references.
    for (const entry of handwritten.thoughts) {
        book.add(rng, 'thoughts', entry.date, { content: entry.content, tags: entry.tags, format: 'plain' }, entry.index);
    }
    for (const entry of handwritten.dreams) {
        book.add(rng, 'dreams', entry.date, { content: entry.content, tags: entry.tags, format: 'plain' }, entry.index);
    }

    for (const date of eachDate('2016-01-01', today)) {
        const year = Number(date.slice(0, 4));
        if (!handwrittenByDate.has(date)) {
            const roll = rng();
            const count = roll < 0.55 ? 1 : roll < 0.85 ? 2 : roll < 0.97 ? 3 : 4;
            for (let i = 0; i < count; i++) {
                book.add(rng, 'thoughts', date, composeEntry(rng, year));
            }
        }

        if (date >= '2017-06-01' && weekday(date) >= 1 && weekday(date) <= 5 && chance(rng, 0.55)) {
            const count = chance(rng, 0.1) ? 2 : 1;
            for (let i = 0; i < count; i++) {
                const content = pickSome(rng, WORK_DIARY_SENTENCES, between(rng, 1, 3)).map((sentence) => fill(rng, sentence)).join(' ');
                book.add(rng, 'work', date, { content, tags: pickSome(rng, TOPICS.work.tags, between(rng, 1, 2)), format: 'plain' });
            }
        }

        if (chance(rng, 0.28)) {
            const content = pickSome(rng, DREAM_SENTENCES, between(rng, 1, 3)).join(' ');
            book.add(rng, 'dreams', date, { content, tags: ['dreams', ...(chance(rng, 0.3) ? [pick(rng, ['lucid', 'nightmare', 'recurring', 'flying'])] : [])], format: 'plain' });
        }

        if (date >= '2018-01-01' && weekday(date) === 0) {
            const items = pickSome(rng, TOPICS.gratitude.sentences, 3).map((sentence) => `- ${fill(rng, sentence)}`);
            book.add(rng, 'gratitude', date, { content: `## This week I am grateful for\n\n${items.join('\n')}`, tags: ['gratitude', ...(chance(rng, 0.4) ? ['family'] : [])], format: 'markdown' });
        }
    }

    // Two or three trips per year in the Travel diary.
    for (let year = 2016; year <= Number(today.slice(0, 4)); year++) {
        const months = pickSome(rng, [3, 5, 7, 9, 10, 12], between(rng, 2, 3));
        for (const month of months) {
            const place = pick(rng, TRAVEL_PLACES);
            const start = `${year}-${String(month).padStart(2, '0')}-${String(between(rng, 1, 18)).padStart(2, '0')}`;
            if (start > today) continue;
            const length = between(rng, 3, 9);
            for (let day = 0; day < length; day++) {
                const date = addDays(start, day);
                if (date > today) break;
                const content = pickSome(rng, TRAVEL_SENTENCES, between(rng, 1, 3)).map((sentence) => sentence.replaceAll('{city}', place.name)).join(' ');
                book.add(rng, 'travel', date, { content, tags: ['travel', place.tag, ...(chance(rng, 0.3) ? ['food'] : [])], format: 'plain' });
            }
        }
    }

    const entries = book.entries;
    addCrossReferences(rng, entries);

    // Entries the duplicate finder should flag (same subject and conclusion) and one it should not.
    const plant = (diary: DiaryKey, daysAgo: number, content: string, tags: string[]) =>
        book.add(rng, diary, addDays(today, -daysAgo), { content, tags, format: 'plain' });
    plant('thoughts', 6, 'I have decided to stop checking email before 9am. Every time I open my inbox first thing, the whole morning becomes reactive and I end up working on other people\'s priorities instead of my own. Starting tomorrow: deep work first, inbox at nine.', ['work', 'habits']);
    plant('thoughts', 2, 'New rule for myself: no email until 9am. When I check the inbox as soon as I wake up, my morning turns reactive and I spend it on everyone else\'s priorities. From now on deep work comes first and email waits until nine.', ['habits', 'work']);
    plant('thoughts', 9, 'Talked to Dad for an hour today. I realized I only call when something is wrong, and that is not the relationship I want. I am going to call him every Sunday, no reason needed.', ['family', 'parents']);
    plant('thoughts', 4, 'Another long call with Dad. It struck me that I usually only phone him when there is a problem, which is not the kind of relationship I want with him. Decision: a Sunday call every week, just to talk.', ['parents', 'family']);
    plant('thoughts', 3, 'Thought about checking email first thing in the morning again. Honestly, for my current role, answering early keeps the team unblocked, so I am keeping the habit for now.', ['work']);
    plant('work', 5, 'Retro takeaway: our standups run too long because we solve problems in them. We agreed to cap standup at fifteen minutes and move discussions to a follow-up.', ['meetings']);
    plant('work', 1, 'We keep solving problems during standup, which is why it drags on. Agreed as a team: standup is capped at fifteen minutes and any discussion moves to a separate follow-up.', ['meetings', 'work']);

    addRevisions(rng, entries);

    for (const entry of entries) {
        const visibilityRate = { thoughts: 0.06, dreams: 0.05, work: 0, travel: 0.7, gratitude: 0.2, notes: 0 }[entry.diary];
        if (chance(rng, visibilityRate)) entry.visibility = 'public';
        if (chance(rng, 0.04)) entry.isFavorite = true;
        if (entry.date < '2020-01-01' && chance(rng, 0.03)) entry.isArchived = true;
    }

    const recentThoughts = entries
        .filter((entry) => entry.diary === 'thoughts' && entry.date >= addDays(today, -40))
        .sort((a, b) => b.date.localeCompare(a.date) || a.index - b.index);
    const milestone = entries.find((entry) => entry.content.startsWith('10+ years of journaling'));
    for (const entry of [milestone, recentThoughts[12], recentThoughts[25]]) {
        if (entry) Object.assign(entry, { isPinned: true, isArchived: false, isFavorite: true });
    }

    const kinds: AttachmentKind[] = ['image', 'text', 'pdf', 'audio'];
    kinds.forEach((kind, i) => {
        const target = recentThoughts[1 + i * 3];
        if (target) target.attachment = kind;
    });
    const lastTrip = entries.filter((entry) => entry.diary === 'travel').at(-1);
    if (lastTrip) lastTrip.attachment = 'image';

    const longEntries = entries.filter((entry) => entry.content.length > 900 && entry.date >= '2024-01-01');
    for (const entry of pickSome(rng, longEntries, 12)) {
        entry.chat = CHAT_TURNS.slice(0, between(rng, 1, 3)).flatMap(([question, answer]) => [
            { role: 'user' as const, content: question },
            { role: 'assistant' as const, content: answer },
        ]);
    }

    return entries;
}

/** A community member's public journal for the feed. */
export function buildCommunityJournal(rng: Rng, today: string, from: string, everyDays: number, publicRate: number): SeedEntry[] {
    const book = new EntryBook();
    for (let date = from; date <= today; date = addDays(date, between(rng, 1, everyDays))) {
        const entry = book.add(rng, 'notes', date, composeEntry(rng, Number(date.slice(0, 4))));
        entry.visibility = chance(rng, publicRate) ? 'public' : 'private';
    }
    return book.entries;
}
