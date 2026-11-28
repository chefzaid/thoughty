import { entryLocationColumns, entryLocationOf, normalizeEntryLocation } from './entry-location.util';
import { generateJsonFile, parseJsonFile } from './file-converter-json.util';

describe('normalizeEntryLocation', () => {
  it('keeps a name on one line within 200 characters, and coordinates to six decimals', () => {
    expect(normalizeEntryLocation({ name: '  Jardin du\n Luxembourg ', latitude: 48.846_234_567, longitude: 2.337_198_765 })).toEqual({
      name: 'Jardin du Luxembourg',
      latitude: 48.846_235,
      longitude: 2.337_199,
    });
    expect(normalizeEntryLocation({ name: 'x'.repeat(250) })?.name).toHaveLength(200);
  });

  it('keeps a name alone, or coordinates alone', () => {
    expect(normalizeEntryLocation({ name: 'Home' })).toEqual({ name: 'Home', latitude: null, longitude: null });
    expect(normalizeEntryLocation({ latitude: -33.8688, longitude: 151.2093 })).toEqual({ name: null, latitude: -33.8688, longitude: 151.2093 });
  });

  it('drops coordinates that are not a pair of numbers within range, such as Journey\'s placeholder', () => {
    expect(normalizeEntryLocation({ name: 'Home', latitude: 1.797_693_134_862_315_7e308, longitude: 1.797_693_134_862_315_7e308 })).toEqual({
      name: 'Home',
      latitude: null,
      longitude: null,
    });
    expect(normalizeEntryLocation({ name: 'Home', latitude: 12 })).toEqual({ name: 'Home', latitude: null, longitude: null });
    expect(normalizeEntryLocation({ latitude: '48.8', longitude: '2.3' })).toBeNull();
    expect(normalizeEntryLocation({ latitude: 91, longitude: 0 })).toBeNull();
    expect(normalizeEntryLocation({ latitude: 0, longitude: -181 })).toBeNull();
    expect(normalizeEntryLocation({ latitude: Number.NaN, longitude: 0 })).toBeNull();
  });

  it('reads nothing, a blank name or something other than an object as no place', () => {
    for (const value of [null, undefined, 'Paris', 42, {}, { name: '   ' }, { name: 7 }]) {
      expect(normalizeEntryLocation(value)).toBeNull();
    }
  });
});

describe('entry location columns', () => {
  it('stores a place in its three columns, and none as three nulls', () => {
    expect(entryLocationColumns({ name: 'Home', latitude: 1, longitude: 2 })).toEqual({ locationName: 'Home', latitude: 1, longitude: 2 });
    expect(entryLocationColumns(null)).toEqual({ locationName: null, latitude: null, longitude: null });
  });

  it('reads the place back from the columns', () => {
    expect(entryLocationOf({ locationName: 'Home', latitude: null, longitude: null })).toEqual({ name: 'Home', latitude: null, longitude: null });
    expect(entryLocationOf({})).toBeNull();
  });
});

describe('places in JSON files', () => {
  const entry = { date: '2026-11-02', index: 1, tags: ['trip'], content: 'By the lake.', locationName: 'Annecy', latitude: 45.8992, longitude: 6.1294 };

  it('leaves places out unless the export asks for them', () => {
    expect(JSON.parse(generateJsonFile([entry])).entries[0]).not.toHaveProperty('location');
    expect(JSON.parse(generateJsonFile([entry], false, true)).entries[0].location).toEqual({ name: 'Annecy', latitude: 45.8992, longitude: 6.1294 });
    expect(JSON.parse(generateJsonFile([{ ...entry, locationName: null, latitude: null, longitude: null }], false, true)).entries[0]).not.toHaveProperty('location');
  });

  it('reads a place back when the file is imported, and ignores one it cannot read', () => {
    const [imported] = parseJsonFile(generateJsonFile([entry], false, true));
    expect(imported.location).toEqual({ name: 'Annecy', latitude: 45.8992, longitude: 6.1294 });

    const [unreadable] = parseJsonFile(JSON.stringify({ entries: [{ date: '2026-11-02', content: 'Text', location: 'Annecy' }] }));
    expect(unreadable).not.toHaveProperty('location');
  });
});
