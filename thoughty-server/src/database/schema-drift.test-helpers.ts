import type { DataSource, EntityMetadata, QueryRunner, Table, TableColumn } from 'typeorm';
import type { ColumnMetadata } from 'typeorm/metadata/ColumnMetadata';
import type { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';

/**
 * Compares what the entities declare with the schema the migrations build. TypeORM runs without
 * `synchronize`, so nothing makes the two agree: a constraint an entity declares but no migration
 * creates (the `diaries (user_id, name)` unique key once) is silently missing, and a column the
 * migrations leave nullable is read as `null` where the entity promises a value.
 *
 * Every column, unique key, index and foreign key an entity declares must exist with the same shape
 * (type, length, nullability, default, ON DELETE / ON UPDATE), and a column the migrations add that
 * no entity maps must not be required on insert. An index TypeORM cannot describe (an expression or
 * GIN index) is declared with `synchronize: false` and matched by name. Indices only the database
 * has are allowed: they serve queries the entities do not express.
 */
export async function findSchemaDrift(dataSource: DataSource): Promise<string[]> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.startTransaction();
  try {
    // TypeORM reads generated-column expressions from the table its own synchronize keeps; the
    // migrations never create it, so an empty one stands in while the schema is read.
    await queryRunner.query(
      'CREATE TABLE typeorm_metadata (type varchar NOT NULL, database varchar, schema varchar, "table" varchar, name varchar, value text)',
    );
    const metadatas = dataSource.entityMetadatas.filter((metadata) => metadata.tableType !== 'view');
    const tables = await queryRunner.getTables(metadatas.map((metadata) => metadata.tablePath));
    const indices = await loadIndices(queryRunner);
    const driver = dataSource.driver as PostgresDriver;
    return metadatas.flatMap((metadata) => {
      const table = tables.find((candidate) => candidate.name === metadata.tablePath);
      if (!table) return [`${metadata.tableName}: table missing`];
      const tableIndices = indices.filter((index) => index.table === metadata.tableName);
      return [
        ...columnDrift(driver, metadata, table),
        ...uniqueDrift(metadata, tableIndices),
        ...indexDrift(metadata, tableIndices),
        ...foreignKeyDrift(metadata, table),
      ].map((problem) => `${metadata.tableName}.${problem}`);
    });
  } finally {
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
  }
}

interface DatabaseIndex {
  table: string;
  name: string;
  unique: boolean;
  /** Key columns in index order; `null` for an expression. */
  columns: (string | null)[];
  where: string | null;
}

/** TypeORM's own reader loses the column order of an index, so the catalog is read directly. */
async function loadIndices(queryRunner: QueryRunner): Promise<DatabaseIndex[]> {
  return queryRunner.query(`
    SELECT t.relname AS "table", i.relname AS name, ix.indisunique AS "unique",
           pg_get_expr(ix.indpred, ix.indrelid) AS "where",
           ARRAY(
             SELECT a.attname::text
               FROM unnest(ix.indkey::int2[]) WITH ORDINALITY AS k(attnum, position)
               LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
              WHERE k.position <= ix.indnkeyatts
              ORDER BY k.position
           ) AS columns
      FROM pg_index ix
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_class t ON t.oid = ix.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = current_schema()`);
}

function columnDrift(driver: PostgresDriver, metadata: EntityMetadata, table: Table): string[] {
  const declared = metadata.columns.flatMap((column) => {
    const tableColumn = table.columns.find((candidate) => candidate.name === column.databaseName);
    if (!tableColumn) return [`${column.databaseName}: column missing`];
    return describeColumnDifferences(driver, column, tableColumn).map(
      (difference) => `${column.databaseName}: ${difference}`,
    );
  });
  const unmapped = table.columns
    .filter((tableColumn) => !metadata.columns.some((column) => column.databaseName === tableColumn.name))
    .filter((tableColumn) => !tableColumn.isNullable && tableColumn.default === undefined && !tableColumn.isGenerated)
    .map((tableColumn) => `${tableColumn.name}: NOT NULL without a default but mapped by no entity column`);
  return [...declared, ...unmapped];
}

function describeColumnDifferences(driver: PostgresDriver, column: ColumnMetadata, tableColumn: TableColumn): string[] {
  const differences: string[] = [];
  const compare = (label: string, entityValue: unknown, databaseValue: unknown) => {
    if (entityValue !== databaseValue) {
      differences.push(`${label} is ${String(entityValue)} in the entity but ${String(databaseValue)} in the database`);
    }
  };
  compare('type', driver.normalizeType(column), tableColumn.type);
  compare('length', column.length || driver.getColumnLength(column) || '', tableColumn.length || '');
  compare('array', column.isArray, tableColumn.isArray);
  compare('nullable', column.isNullable, tableColumn.isNullable);
  compare('primary', column.isPrimary, tableColumn.isPrimary);
  compare('generated', column.isGenerated, tableColumn.isGenerated);
  // A default only the database has is harmless: TypeORM leaves unset properties out of an insert.
  const entityDefault = driver.normalizeDefault(column);
  if (!column.isGenerated && entityDefault !== undefined) {
    compare('default', normalizeDefault(entityDefault), normalizeDefault(tableColumn.default));
  }
  return differences;
}

/** `now()` and `CURRENT_TIMESTAMP` are one default; JSON defaults compare by value, not spacing. */
function normalizeDefault(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (/^(now\(\)|CURRENT_TIMESTAMP)$/i.test(value)) return 'now()';
  const json = /^'(.*)'(::jsonb?)?$/s.exec(value);
  if (json && /^[[{]/.test(json[1])) {
    try {
      return JSON.stringify(JSON.parse(json[1]));
    } catch {
      return value;
    }
  }
  return value;
}

const sameColumns = (left: (string | null)[], right: string[]): boolean =>
  left.length === right.length && left.every((column, position) => column === right[position]);

/** A unique key the entity declares (`@Unique`, `unique: true`) must be enforced by a unique index on those columns. */
function uniqueDrift(metadata: EntityMetadata, indices: DatabaseIndex[]): string[] {
  const sorted = (columns: (string | null)[]) => [...columns].sort((left, right) => String(left).localeCompare(String(right)));
  return metadata.uniques
    .map((unique) => unique.columns.map((column) => column.databaseName))
    .filter((columns) => !indices.some((index) => index.unique && !index.where && sameColumns(sorted(index.columns), sorted(columns) as string[])))
    .map((columns) => `(${columns.join(', ')}): unique key missing`);
}

function indexDrift(metadata: EntityMetadata, indices: DatabaseIndex[]): string[] {
  return metadata.indices.flatMap((index) => {
    // TypeORM takes only a name for such an index, so its shape is the migration's to test.
    if (index.synchronize === false) {
      return indices.some((candidate) => candidate.name === index.name) ? [] : [`${index.name}: index missing`];
    }
    const columns = index.columns.map((column) => column.databaseName);
    const exists = indices.some(
      (candidate) =>
        sameColumns(candidate.columns, columns) &&
        candidate.unique === index.isUnique &&
        normalizeWhere(candidate.where) === normalizeWhere(index.where),
    );
    if (exists) return [];
    const shape = [columns.join(', '), index.isUnique ? 'unique' : '', index.where ? `WHERE ${index.where}` : ''];
    return [`${index.name} (${shape.filter(Boolean).join(', ')}): index missing`];
  });
}

/** PostgreSQL stores a partial index predicate re-printed (`(deleted_at IS NOT NULL)`). */
function normalizeWhere(where: string | null | undefined): string {
  return (where ?? '').replace(/[()"\s]/g, '').toLowerCase();
}

function foreignKeyDrift(metadata: EntityMetadata, table: Table): string[] {
  return metadata.foreignKeys.flatMap((foreignKey) => {
    const columns = foreignKey.columnNames;
    const label = `(${columns.join(', ')}) -> ${foreignKey.referencedTablePath}`;
    const existing = table.foreignKeys.find(
      (candidate) =>
        candidate.columnNames.join(',') === columns.join(',') &&
        candidate.referencedTableName === foreignKey.referencedTablePath &&
        candidate.referencedColumnNames.join(',') === foreignKey.referencedColumnNames.join(','),
    );
    if (!existing) return [`${label}: foreign key missing`];
    return (['onDelete', 'onUpdate'] as const)
      .filter((action) => (existing[action] ?? 'NO ACTION') !== (foreignKey[action] ?? 'NO ACTION'))
      .map((action) => `${label}: ${action} is ${foreignKey[action] ?? 'NO ACTION'} in the entity but ${existing[action] ?? 'NO ACTION'} in the database`);
  });
}
