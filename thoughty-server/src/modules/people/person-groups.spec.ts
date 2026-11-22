import { normalizePersonGroups } from './person-groups';

describe('normalizePersonGroups', () => {
  it('keeps each group once ignoring case, in the order given, with its first spelling', () => {
    expect(normalizePersonGroups(['Family', 'climbing', 'family', 'Climbing', 'Work'], [])).toEqual(['Family', 'climbing', 'Work']);
  });

  it('writes a group as the writer already spells it on their other people', () => {
    expect(normalizePersonGroups(['friends', 'ÉQUIPE', 'Neighbours'], ['Friends', 'équipe', 'friends', 'Colleagues']))
      .toEqual(['Friends', 'équipe', 'Neighbours']);
  });

  it('reads no groups as none', () => {
    expect(normalizePersonGroups([], ['Friends'])).toEqual([]);
  });
});
