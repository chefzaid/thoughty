import { describe, expect, it } from 'vitest';

import { addPersonGroup, collectPersonGroups, personGroupKey, samePersonGroups } from './personGroups';

describe('person groups', () => {
  it('tells groups apart ignoring case and spaces around them', () => {
    expect(personGroupKey('  Équipe ')).toBe('équipe');
  });

  it('collects every group once with its first spelling and how many people are in it, by name', () => {
    expect(collectPersonGroups([
      { groups: ['Friends', 'climbing'] },
      { groups: ['friends', 'Family', 'FRIENDS'] },
      { groups: [] },
      { groups: ['Climbing', 'équipe'] },
    ], 'fr')).toEqual([
      { key: 'climbing', name: 'climbing', count: 2 },
      { key: 'équipe', name: 'équipe', count: 1 },
      { key: 'family', name: 'Family', count: 1 },
      { key: 'friends', name: 'Friends', count: 2 },
    ]);
    expect(collectPersonGroups([])).toEqual([]);
  });

  it('adds a trimmed group once, spelled as one the writer already has', () => {
    expect(addPersonGroup(['Work'], '  friends ', ['Family', 'Friends'])).toEqual(['Work', 'Friends']);
    expect(addPersonGroup(['Work'], 'Climbing', ['Friends'])).toEqual(['Work', 'Climbing']);
    expect(addPersonGroup(['Work'], 'WORK', [])).toEqual(['Work']);
    expect(addPersonGroup(['Work'], '   ', [])).toEqual(['Work']);
  });

  it('compares two lists of groups in order', () => {
    expect(samePersonGroups(['Friends', 'Work'], ['Friends', 'Work'])).toBe(true);
    expect(samePersonGroups(['Work', 'Friends'], ['Friends', 'Work'])).toBe(false);
    expect(samePersonGroups(['Friends'], ['Friends', 'Work'])).toBe(false);
  });
});
