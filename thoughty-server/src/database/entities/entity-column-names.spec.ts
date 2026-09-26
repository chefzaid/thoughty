import { getMetadataArgsStorage } from 'typeorm';
import * as entities from './index';

/**
 * The schema uses snake_case columns and TypeORM runs without a naming
 * strategy, so a camelCase property without an explicit column name maps to
 * a column that does not exist and fails at runtime.
 */
describe('entity column names', () => {
  it('maps every camelCase property to an explicit snake_case column', () => {
    const entityTargets = new Set(Object.values(entities).filter((value) => typeof value === 'function'));
    const storage = getMetadataArgsStorage();
    const problems = [
      ...storage.columns.map(({ target, propertyName, options }) => ({ target, propertyName, name: options.name })),
      ...storage.joinColumns.map(({ target, propertyName, name }) => ({ target, propertyName: `${propertyName} (join)`, name })),
    ]
      .filter(({ target }) => entityTargets.has(target as never))
      .filter(({ propertyName, name }) => (name ?? propertyName.replace(' (join)', '')) !== (name ?? propertyName.replace(' (join)', '')).toLowerCase())
      .map(({ target, propertyName, name }) => `${(target as { name: string }).name}.${propertyName} -> ${name ?? '(default)'}`);

    expect(problems).toEqual([]);
  });
});
