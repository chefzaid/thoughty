import type { Person } from '../services/api/peopleService';
import { JOURNAL_PERSON_PARAM } from './appRouting';

/**
 * People mentions (`@Marie`, `@Jean-Paul`), read with the same rules as the server's
 * `thoughty-server/src/common/utils/entry-mentions.util.ts`, which links entries to people when they
 * are saved: change both together. A handle starts with a letter, goes on with letters, marks and
 * digits joined by single `-` or `_`, and holds at most 50 characters; e-mail addresses, domains,
 * code, `[[date]]` references, links and web addresses are never mentions.
 */
export const MENTION_HANDLE_MAX_LENGTH = 50;

/** The people list, refreshed with the journal: saving, deleting or restoring entries changes the counts. */
export const PEOPLE_QUERY_KEY = ['app', 'people'] as const;

const MENTION_PATTERN =
    /(?<![\p{L}\p{M}\p{N}.@/\\+`-])@([\p{L}][\p{L}\p{M}\p{N}]*(?:[-_][\p{L}\p{M}\p{N}]+)*)(?![\p{L}\p{M}\p{N}@]|[.\-_][\p{L}\p{M}\p{N}])/gu;

const EXCLUDED_PATTERNS: readonly RegExp[] = [
    /^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^ {0,3}\1[^\n]*$|(?![\s\S]))/gm,
    /(`+)[\s\S]*?\1/g,
    /\[\[[^\]\n]*\]\]/g,
    /!?\[[^\]\n]*\]\([^)\n]*\)/g,
    /<[a-z][a-z0-9+.-]*:[^>\s]*>/gi,
    /\b(?:https?:\/\/|www\.)[^\s<>]+/gi,
];

/** The text a handle is typed with, after an `@` and before the caret: possibly empty, possibly ending with a joiner. */
const TYPED_HANDLE_PATTERN = /(?<![\p{L}\p{M}\p{N}.@/\\+`-])@((?:[\p{L}][\p{L}\p{M}\p{N}]*(?:[-_][\p{L}\p{M}\p{N}]*)*)?)$/u;

export interface MentionMatch {
    /** The case-insensitive key: the handle's NFC form in lower case. */
    readonly handle: string;
    /** Where the `@` is. */
    readonly start: number;
    /** Just after the handle. */
    readonly end: number;
}

/** The case-insensitive key of a handle, written with or without its `@`. */
export function normalizeMentionHandle(handle: string): string {
    return handle.replace(/^@/, '').normalize('NFC').toLowerCase();
}

function maskExcludedText(content: string): string {
    let masked = content;
    for (const pattern of EXCLUDED_PATTERNS) {
        masked = masked.replace(pattern, (match) => match.replace(/[^\n]/g, ' '));
    }
    return masked;
}

/** Every mention in the text, in order. */
export function findMentions(content: string): MentionMatch[] {
    if (!content?.includes('@')) {
        return [];
    }
    const mentions: MentionMatch[] = [];
    for (const match of maskExcludedText(content).matchAll(MENTION_PATTERN)) {
        const written = match[1] ?? '';
        const handle = normalizeMentionHandle(written);
        if (written.length > MENTION_HANDLE_MAX_LENGTH || handle.length > MENTION_HANDLE_MAX_LENGTH) {
            continue;
        }
        mentions.push({ handle, start: match.index, end: match.index + 1 + written.length });
    }
    return mentions;
}

/** Each of the people's handles, to the person it mentions. */
export function peopleByHandle(people: readonly Person[]): ReadonlyMap<string, Person> {
    const byHandle = new Map<string, Person>();
    for (const person of people) {
        for (const handle of person.handles) byHandle.set(handle, person);
    }
    return byHandle;
}

/** The journal of every entry that mentions the person, in all diaries. */
export function personJournalPath(personId: number): string {
    return `/journal?diary=all&${JOURNAL_PERSON_PARAM}=${personId}`;
}

/** The handle being typed just before the caret, from its `@`; null when the caret is not on one. */
export function typedMention(text: string, caret: number): { start: number; query: string } | null {
    const match = TYPED_HANDLE_PATTERN.exec(text.slice(0, caret));
    if (!match || masksPosition(text, match.index)) {
        return null;
    }
    const query = match[1] ?? '';
    return query.length > MENTION_HANDLE_MAX_LENGTH ? null : { start: match.index, query };
}

/** Whether the position is inside code, a link or a web address, where no mention is read. */
function masksPosition(text: string, position: number): boolean {
    return maskExcludedText(text)[position] !== text[position];
}

/** How a person is written after the `@`: their name when it is one of their handles (keeping its case), else their first handle. */
export function mentionText(person: Pick<Person, 'name' | 'handles'>, handle = person.handles[0] ?? ''): string {
    return normalizeMentionHandle(person.name) === handle && findMentions(`@${person.name}`).length === 1
        ? person.name
        : handle;
}

/**
 * People whose handle or name starts with what is typed, the most mentioned first, each with the
 * handle to write: the one that matched, or the first. An empty query lists the most mentioned.
 */
export function suggestPeople(people: readonly Person[], query: string, limit = 6): Array<{ person: Person; handle: string }> {
    const key = normalizeMentionHandle(query);
    const suggestions: Array<{ person: Person; handle: string }> = [];
    for (const person of people) {
        const matched = person.handles.find((candidate) => candidate.startsWith(key));
        const nameMatches = normalizeMentionHandle(person.name).split(/\s+/).some((word) => word.startsWith(key));
        const handle = matched ?? (nameMatches ? person.handles[0] : undefined);
        if (handle !== undefined) {
            suggestions.push({ person, handle });
        }
    }
    return suggestions
        .sort((left, right) => right.person.entryCount - left.person.entryCount
            || left.person.name.localeCompare(right.person.name))
        .slice(0, limit);
}
