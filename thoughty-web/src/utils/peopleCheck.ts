import type { Person } from '../services/api/peopleService';
import { findMentions, peopleByHandle } from './mentions';

/**
 * The check before an entry is shared: which people its text names, by `@` mention or by a name or alias
 * from the writer's People page, since in the feed and in what is shared a mention is only the text written.
 * It reads only the writer's own People list, on the device; nothing about it is stored or sent.
 */

/** One text shared: an entry's title and text, or a card's. */
export interface SharedText {
    /** Which entry (or card) the text belongs to. */
    readonly key: string | number;
    readonly title: string;
    readonly text: string;
}

/** Someone the shared texts name. */
export interface SharedPerson {
    /** `person:<id>` for someone on the People page, `handle:<handle>` for a mention of no one there yet. */
    readonly key: string;
    /** Their name on the People page, or the mention as written. */
    readonly name: string;
    /** How many times the texts name them. */
    readonly count: number;
}

interface Occurrence {
    readonly personKey: string;
    readonly start: number;
    readonly end: number;
}

/** Where a name is not read: web addresses, `<scheme:…>` links and a Markdown link's destination. */
const ADDRESS_PATTERNS: readonly RegExp[] = [
    /<[a-z][a-z0-9+.-]*:[^>\s]*>/gi,
    /\b(?:https?:\/\/|www\.)[^\s<>]+/gi,
    /\]\([^)\n]*\)/g,
];

/** A name written on its own: not inside a word, a handle, an e-mail address or a path. */
const BEFORE_NAME = String.raw`(?<![\p{L}\p{M}\p{N}.@/\\+_-])`;
const AFTER_NAME = String.raw`(?![\p{L}\p{M}\p{N}@_]|[.\-][\p{L}\p{M}\p{N}])`;

function maskAddresses(text: string): string {
    let masked = text;
    for (const pattern of ADDRESS_PATTERNS) {
        masked = masked.replace(pattern, (match) => match.replace(/[^\n]/g, ' '));
    }
    return masked;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

/** The words a person goes by in plain text: their name and their handles (aliases), longest first. */
function namesOf(person: Person): string[] {
    const names = new Set([person.name.normalize('NFC').trim(), ...person.handles].filter((name) => name.length > 0));
    return [...names].sort((left, right) => right.length - left.length);
}

/** The pattern matching any of the names on its own, ignoring case; null when there are none. */
function namePattern(people: readonly Person[]): { pattern: RegExp; byName: Map<string, Person> } | null {
    const byName = new Map<string, Person>();
    for (const person of people) {
        for (const name of namesOf(person)) {
            const key = name.toLowerCase();
            if (!byName.has(key)) byName.set(key, person);
        }
    }
    if (byName.size === 0) return null;
    const alternatives = [...byName.keys()].sort((left, right) => right.length - left.length).map(escapeRegExp);
    return { pattern: new RegExp(`${BEFORE_NAME}(?:${alternatives.join('|')})${AFTER_NAME}`, 'giu'), byName };
}

type Matcher = (text: string) => Occurrence[];

/** Finds each person a text names, where: mentions first, then names and aliases written without `@`. */
function peopleMatcher(people: readonly Person[]): Matcher {
    const byHandle = peopleByHandle(people);
    const names = namePattern(people);
    return (normalized) => occurrencesIn(normalized, byHandle, names);
}

function occurrencesIn(
    normalized: string,
    byHandle: ReadonlyMap<string, Person>,
    names: ReturnType<typeof namePattern>,
): Occurrence[] {
    const found: Occurrence[] = findMentions(normalized).map((mention) => {
        const person = byHandle.get(mention.handle);
        return { personKey: person ? `person:${person.id}` : `handle:${mention.handle}`, start: mention.start, end: mention.end };
    });
    if (names) {
        for (const match of maskAddresses(normalized).matchAll(names.pattern)) {
            const start = match.index;
            const end = start + match[0].length;
            const person = names.byName.get(match[0].toLowerCase());
            if (person && !found.some((other) => start < other.end && other.start < end)) {
                found.push({ personKey: `person:${person.id}`, start, end });
            }
        }
    }
    return found.sort((left, right) => left.start - right.start);
}

/** The people the texts name, the most named first. */
export function findSharedPeople(texts: readonly SharedText[], people: readonly Person[]): SharedPerson[] {
    const byKey = new Map<string, { name: string; count: number }>();
    const byId = new Map(people.map((person) => [`person:${person.id}`, person.name]));
    const match = peopleMatcher(people);
    for (const { title, text } of texts) {
        for (const part of [title, text]) {
            const normalized = part.normalize('NFC');
            for (const occurrence of match(normalized)) {
                const current = byKey.get(occurrence.personKey);
                const name = byId.get(occurrence.personKey) ?? normalized.slice(occurrence.start, occurrence.end);
                byKey.set(occurrence.personKey, { name: current?.name ?? name, count: (current?.count ?? 0) + 1 });
            }
        }
    }
    return [...byKey.entries()]
        .map(([key, { name, count }]) => ({ key, name, count }))
        .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
}

/** A person's initials: the first letter of each word of their name, as "M. D." (a mention's `@` aside). */
export function personInitials(name: string): string {
    const words = name.replace(/^@/, '').split(/[\s_-]+/u).filter((word) => word.length > 0);
    return words.map((word) => `${(Array.from(word)[0] ?? '').toLocaleUpperCase()}.`).join(' ');
}

/** Whether the position starts a sentence: the start of the text or of a line, or after `.`, `!`, `?` or `…`. */
function startsSentence(text: string, position: number): boolean {
    return /(?:^|[.!?…]\s+|\n\s*)$/u.test(text.slice(0, position));
}

/**
 * The text with each person chosen written as their replacement (a mention's `@` included), a replacement
 * word starting with a capital at the start of a sentence; people with no replacement stay as written.
 */
export function replaceSharedPeople(text: string, people: readonly Person[], replacements: ReadonlyMap<string, string>): string {
    return replaceWith(text, peopleMatcher(people), replacements);
}

function replaceWith(text: string, match: Matcher, replacements: ReadonlyMap<string, string>): string {
    const normalized = text.normalize('NFC');
    return match(normalized).reduceRight((current, occurrence) => {
        const replacement = replacements.get(occurrence.personKey);
        if (replacement === undefined) return current;
        const written = startsSentence(current, occurrence.start)
            ? `${replacement.charAt(0).toLocaleUpperCase()}${replacement.slice(1)}`
            : replacement;
        return `${current.slice(0, occurrence.start)}${written}${current.slice(occurrence.end)}`;
    }, normalized);
}

/** The texts the replacements change, with their new title and text. */
export function rewriteSharedTexts(
    texts: readonly SharedText[],
    people: readonly Person[],
    replacements: ReadonlyMap<string, string>,
): SharedText[] {
    const match = peopleMatcher(people);
    return texts.flatMap((shared) => {
        const title = replaceWith(shared.title, match, replacements);
        const text = replaceWith(shared.text, match, replacements);
        return title === shared.title.normalize('NFC') && text === shared.text.normalize('NFC') ? [] : [{ key: shared.key, title, text }];
    });
}
