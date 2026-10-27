import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import * as ts from 'typescript';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

/** Every TypeScript file under a folder, nested folders included. */
function listTypeScriptFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((item) => {
    const path = join(dir, item.name);
    if (item.isDirectory()) return listTypeScriptFiles(path);
    return item.name.endsWith('.ts') ? [path] : [];
  });
}

/**
 * The modules a migration file loads (static and dynamic imports, re-exports and `require`) that are
 * neither TypeORM, a Node built-in, nor a file under the migrations folder.
 */
function forbiddenImports(file: string, source: string): string[] {
  const { importedFiles } = ts.preProcessFile(source, true, true);
  return importedFiles
    .map(({ fileName }) => fileName)
    .filter((specifier) => {
      if (specifier === 'typeorm' || specifier.startsWith('node:')) return false;
      if (!specifier.startsWith('.')) return true;
      const target = resolve(join(file, '..'), specifier);
      return !target.startsWith(MIGRATIONS_DIR + sep);
    });
}

describe('migration imports', () => {
  it('load only TypeORM, Node built-ins and files under the migrations folder', () => {
    const files = listTypeScriptFiles(MIGRATIONS_DIR);
    expect(files.length).toBeGreaterThan(20);

    const offenders = files.flatMap((file) =>
      forbiddenImports(file, readFileSync(file, 'utf8')).map((specifier) => `${relative(MIGRATIONS_DIR, file)}: ${specifier}`),
    );
    expect(offenders).toEqual([]);
  });

  it('keep their frozen logic to themselves: no application file loads it', () => {
    const appFiles = [...listTypeScriptFiles(join(__dirname, '..')), ...listTypeScriptFiles(join(__dirname, '..', '..', 'scripts'))].filter(
      (file) => !file.startsWith(MIGRATIONS_DIR + sep) && !file.endsWith('.spec.ts'),
    );
    expect(appFiles.length).toBeGreaterThan(100);

    const loaders = appFiles.filter((file) =>
      ts.preProcessFile(readFileSync(file, 'utf8'), true, true).importedFiles.some(({ fileName }) => fileName.includes('migrations/')),
    );
    expect(loaders).toEqual([]);
  });

  it('catches application code loaded through aliases, packages, relative paths, require and import()', () => {
    const migration = join(MIGRATIONS_DIR, '1900000000000-example.ts');
    const source = [
      "import type { QueryRunner } from 'typeorm';",
      "import { join } from 'node:path';",
      "import { frozen } from './frozen/1900000000000-example';",
      "import { apiError } from '@/common/errors';",
      "import { sync } from '../../modules/entries/entry-mentions.sync';",
      "export { other } from '../entities';",
      "import lodash from 'lodash';",
      "const util = require('../../common/utils/entry-mentions.util');",
      "const later = import('../data-source');",
    ].join('\n');

    expect(forbiddenImports(migration, source)).toEqual([
      '@/common/errors',
      '../../modules/entries/entry-mentions.sync',
      '../entities',
      'lodash',
      '../../common/utils/entry-mentions.util',
      '../data-source',
    ]);
    expect(forbiddenImports(join(MIGRATIONS_DIR, 'frozen', 'example.ts'), "import { a } from '../1900000000000-example';")).toEqual([]);
  });
});
