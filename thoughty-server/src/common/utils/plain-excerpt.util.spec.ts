import { plainExcerpt } from './plain-excerpt.util';

describe('plainExcerpt', () => {
  it('turns Markdown into a short plain excerpt', () => {
    expect(plainExcerpt('# Sunday\n\n> A **long** walk to [the pier](https://x.y) ![photo](a.jpg)\n\n- bread\n1. milk\n```\ncode\n```\nWell\\-known', 200))
      .toBe('Sunday A long walk to the pier bread milk Well-known');
    expect(plainExcerpt('one two three four five six seven', 15)).toBe('one two three…');
    expect(plainExcerpt('Supercalifragilistic', 10)).toBe('Supercalif…');
  });
});
