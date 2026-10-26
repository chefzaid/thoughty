import { describe, expect, it } from 'vitest';
import { translations, type Language } from './translations';

type Table = Record<Language, Record<string, string>>;

// Every feature file beside translations.ts, found by name so a new file is checked too.
const modules = import.meta.glob<Record<string, unknown>>(['./translations.*.ts', '!./translations.test.ts'], {
  eager: true,
});

const tables = Object.entries(modules).flatMap(([file, exports]) =>
  Object.entries(exports)
    .filter(([name]) => name.endsWith('Translations'))
    .map(([name, table]) => ({ file, name, table: table as Table })),
);

describe('translations', () => {
  it('finds one table in every feature file', () => {
    expect(tables.length).toBeGreaterThan(0);
    expect(new Set(tables.map(({ file }) => file)).size).toBe(Object.keys(modules).length);
  });

  it.each(tables.map(({ name, table }) => [name, table] as const))(
    '%s has the same keys in English and French, each with text',
    (_name, table) => {
      expect(Object.keys(table.fr).sort()).toEqual(Object.keys(table.en).sort());
      for (const language of ['en', 'fr'] as const) {
        for (const value of Object.values(table[language])) {
          expect(typeof value).toBe('string');
          expect(value.trim()).not.toBe('');
        }
      }
    },
  );

  it('defines each key in only one feature file', () => {
    const owners = new Map<string, string[]>();
    for (const { name, table } of tables) {
      for (const key of Object.keys(table.en)) owners.set(key, [...(owners.get(key) ?? []), name]);
    }
    const shared = [...owners].filter(([, names]) => names.length > 1);
    expect(shared).toEqual([]);
  });

  it('merges every feature table, and nothing else, in both languages', () => {
    for (const language of ['en', 'fr'] as const) {
      const merged = Object.assign({}, ...tables.map(({ table }) => table[language]));
      expect(translations[language]).toEqual(merged);
    }
    expect(Object.keys(translations.fr).sort()).toEqual(Object.keys(translations.en).sort());
  });
});
