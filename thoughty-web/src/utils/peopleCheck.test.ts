import { describe, expect, it } from 'vitest';

import type { Person } from '../services/api/peopleService';
import { findSharedPeople, personInitials, replaceSharedPeople, rewriteSharedTexts } from './peopleCheck';

const person = (id: number, name: string, handles: string[]): Person => ({
  id, name, handles, date: null, entryCount: 1, lastMentionedOn: null, createdAt: '', updatedAt: '',
});

const marie = person(1, 'Marie Dupont', ['marie', 'mamie']);
const paul = person(2, 'Paul', ['paul']);
const people = [marie, paul];

const shared = (text: string, title = '') => [{ key: 1, title, text }];

describe('findSharedPeople', () => {
  it('finds mentions, names and aliases, ignoring case, the most named first', () => {
    expect(findSharedPeople(shared('Lunch with @Marie, then marie dupont and Mamie called. PAUL too.', 'Marie Dupont'), people)).toEqual([
      { key: 'person:1', name: 'Marie Dupont', count: 4 },
      { key: 'person:2', name: 'Paul', count: 1 },
    ]);
  });

  it('lists a mention of someone not on the People page yet by the mention written', () => {
    expect(findSharedPeople(shared('Met @Jean-Luc and @jean-luc'), people)).toEqual([
      { key: 'handle:jean-luc', name: '@Jean-Luc', count: 2 },
    ]);
  });

  it('reads no name inside a word, an e-mail address, a handle or a web address', () => {
    const text = 'Paulette wrote to paul@example.com about https://paul.example/marie and [the map](https://x.test/Paul) @paulo';
    expect(findSharedPeople(shared(text), people)).toEqual([{ key: 'handle:paulo', name: '@paulo', count: 1 }]);
  });

  it('reads a name in a link text and before punctuation', () => {
    expect(findSharedPeople(shared('[Paul](https://x.test) and Paul’s dog, Paul.'), people)).toEqual([
      { key: 'person:2', name: 'Paul', count: 3 },
    ]);
  });

  it('finds no one in a text that names no one, or with an empty People list', () => {
    expect(findSharedPeople(shared('A quiet day'), people)).toEqual([]);
    expect(findSharedPeople(shared('Paul came'), [])).toEqual([]);
  });

  it('counts each person across several entries', () => {
    expect(findSharedPeople([{ key: 1, title: '', text: 'Paul' }, { key: 2, title: '', text: '@paul' }], people)).toEqual([
      { key: 'person:2', name: 'Paul', count: 2 },
    ]);
  });
});

describe('personInitials', () => {
  it('writes the first letter of each word, for a name or a mention', () => {
    expect(personInitials('Marie Dupont')).toBe('M. D.');
    expect(personInitials('@jean-luc')).toBe('J. L.');
    expect(personInitials('élodie')).toBe('É.');
    expect(personInitials('  ')).toBe('');
  });
});

describe('replaceSharedPeople', () => {
  it('writes the replacement in place of each mention and name, capitalized at the start of a sentence', () => {
    const replacements = new Map([['person:1', 'a friend'], ['person:2', 'P.']]);
    expect(replaceSharedPeople('Marie Dupont came. Then @marie and Paul left! mamie stayed.', people, replacements))
      .toBe('A friend came. Then a friend and P. left! A friend stayed.');
  });

  it('keeps people without a replacement as written', () => {
    expect(replaceSharedPeople('@Marie and Paul', people, new Map([['person:2', 'a friend']]))).toBe('@Marie and a friend');
  });

  it('replaces a mention of someone not on the People page', () => {
    expect(replaceSharedPeople('Met @newfriend\ntoday', people, new Map([['handle:newfriend', 'N.']]))).toBe('Met N.\ntoday');
  });
});

describe('rewriteSharedTexts', () => {
  it('returns only the texts the replacements change, with their new title and text', () => {
    const texts = [
      { key: 1, title: 'With Paul', text: 'A walk' },
      { key: 2, title: '', text: 'Alone' },
    ];
    expect(rewriteSharedTexts(texts, people, new Map([['person:2', 'a friend']]))).toEqual([
      { key: 1, title: 'With a friend', text: 'A walk' },
    ]);
  });
});
