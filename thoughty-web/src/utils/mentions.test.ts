import { describe, expect, it } from 'vitest';

import type { Person } from '../services/api/peopleService';
import {
    MENTION_HANDLE_MAX_LENGTH,
    findMentions,
    mentionText,
    normalizeMentionHandle,
    peopleByHandle,
    personJournalPath,
    suggestPeople,
    typedMention,
} from './mentions';

const person = (id: number, name: string, handles: string[], entryCount = 1): Person => ({
    id, name, handles, entryCount, lastMentionedOn: null, createdAt: '', updatedAt: '',
});
const handles = (content: string) => findMentions(content).map((mention) => content.slice(mention.start + 1, mention.end));

describe('mentions', () => {
    // The same cases as the server's entry-mentions.util.spec.ts, which links entries to people
    it('reads handles of any script with the server’s rules', () => {
        expect(findMentions('Lunch with @Marie and @Jean-Paul.')).toEqual([
            { handle: 'marie', start: 11, end: 17 },
            { handle: 'jean-paul', start: 22, end: 32 },
        ]);
        expect(handles('@李雷 meets @محمد, @Ольга and @Zoë-2 or @marie_c')).toEqual(['李雷', 'محمد', 'Ольга', 'Zoë-2', 'marie_c']);
        expect(handles('(@Anna) "@Ben" *@Cleo* _@Dan_ **@Eve**')).toEqual(['Anna', 'Ben', 'Cleo', 'Dan', 'Eve']);
        expect(handles("@Marie's book, @Max- and @Kim--then")).toEqual(['Marie', 'Max', 'Kim']);
        expect(handles('marie@example.com, @example.com, site.com/@bob, \\@escaped, @2pm, @@double')).toEqual([]);
        expect(handles('`@code` ```\n@fenced\n``` [[2024-01-01]] [@Linked](https://x.com/@a) https://medium.com/@bob then @After'))
            .toEqual(['After']);
        expect(handles(`@${'a'.repeat(MENTION_HANDLE_MAX_LENGTH + 1)} @${'b'.repeat(MENTION_HANDLE_MAX_LENGTH)}`))
            .toEqual(['b'.repeat(MENTION_HANDLE_MAX_LENGTH)]);
        expect(findMentions('')).toEqual([]);
    });

    it('compares handles without case, in their composed form', () => {
        expect(normalizeMentionHandle('@ÉLODIE')).toBe('élodie');
        expect(normalizeMentionHandle('Élodie')).toBe('élodie');
    });

    it('finds the handle being typed before the caret, outside code', () => {
        expect(typedMention('Tea with @Ma', 12)).toEqual({ start: 9, query: 'Ma' });
        expect(typedMention('Tea with @', 10)).toEqual({ start: 9, query: '' });
        expect(typedMention('@Jean-', 6)).toEqual({ start: 0, query: 'Jean-' });
        expect(typedMention('Tea with @Ma and more', 21)).toBeNull();
        expect(typedMention('mail marie@ex', 13)).toBeNull();
        expect(typedMention('`@co', 4)).toBeNull();
        expect(typedMention(`@${'a'.repeat(MENTION_HANDLE_MAX_LENGTH + 1)}`, MENTION_HANDLE_MAX_LENGTH + 2)).toBeNull();
    });

    it('maps every handle to its person and links to their entries', () => {
        const marie = person(12, 'Marie', ['marie', 'mariec']);
        expect([...peopleByHandle([marie]).entries()]).toEqual([['marie', marie], ['mariec', marie]]);
        expect(personJournalPath(12)).toBe('/journal?diary=all&person=12');
    });

    it('writes a person by their name when it is one of their handles, else by the handle', () => {
        expect(mentionText(person(1, 'Marie', ['marie']))).toBe('Marie');
        expect(mentionText(person(1, 'Marie Curie', ['marie']))).toBe('marie');
        expect(mentionText(person(1, 'Marie', ['marie', 'mc']), 'mc')).toBe('mc');
    });

    it('suggests people by handle or name, the most mentioned first, with the handle that matched', () => {
        const people = [
            person(1, 'Marie Curie', ['marie', 'mc'], 2),
            person(2, 'Martin', ['martin'], 5),
            person(3, 'Zoë', ['zoe'], 9),
            person(4, 'Anna Mars', ['anna'], 1),
        ];
        expect(suggestPeople(people, 'ma').map(({ person: { id }, handle }) => [id, handle])).toEqual([[2, 'martin'], [1, 'marie'], [4, 'anna']]);
        expect(suggestPeople(people, 'MC').map(({ handle }) => handle)).toEqual(['mc']);
        expect(suggestPeople(people, 'curie').map(({ handle }) => handle)).toEqual(['marie']);
        expect(suggestPeople(people, '').map(({ person: { id } }) => id)).toEqual([3, 2, 1, 4]);
        expect(suggestPeople(people, '', 2)).toHaveLength(2);
        expect(suggestPeople([person(5, 'Nobody', [])], 'nob')).toEqual([]);
    });
});
