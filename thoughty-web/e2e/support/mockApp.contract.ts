import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The subset of OpenAPI 3 schema keywords the API's contract uses. */
export interface ContractSchema {
  $ref?: string;
  type?: string;
  nullable?: boolean;
  enum?: unknown[];
  properties?: Record<string, ContractSchema>;
  required?: string[];
  additionalProperties?: boolean | ContractSchema;
  items?: ContractSchema;
  allOf?: ContractSchema[];
  oneOf?: ContractSchema[];
  anyOf?: ContractSchema[];
}

interface OpenApiDocument {
  paths: Record<string, Record<string, { responses?: Record<string, { content?: Record<string, { schema?: ContractSchema }> }> }>>;
  components: { schemas: Record<string, ContractSchema> };
}

interface Operation {
  method: string;
  pattern: RegExp;
  /** Literal path segments, so `/api/diaries/reorder` wins over `/api/diaries/{id}`. */
  literalSegments: number;
  responses: Record<string, ContractSchema | undefined>;
}

const OPENAPI_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../../../thoughty-server/openapi/openapi.json');

let documentCache: OpenApiDocument | null = null;
let operationsCache: Operation[] | null = null;

function loadDocument(): OpenApiDocument {
  documentCache ??= JSON.parse(readFileSync(OPENAPI_PATH, 'utf8')) as OpenApiDocument;
  return documentCache;
}

function loadOperations(): Operation[] {
  if (operationsCache) return operationsCache;
  operationsCache = Object.entries(loadDocument().paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, operation]) => ({
      method: method.toUpperCase(),
      pattern: new RegExp(`^${path.replace(/\{[^}]+\}/g, '[^/]+')}$`),
      literalSegments: path.split('/').filter((segment) => segment && !segment.startsWith('{')).length,
      responses: Object.fromEntries(
        Object.entries(operation.responses ?? {}).map(([status, response]) => [
          status,
          response.content?.['application/json']?.schema,
        ]),
      ),
    })),
  );
  return operationsCache;
}

function describeValue(value: unknown): string {
  if (value === null) return 'null';
  return Array.isArray(value) ? 'array' : typeof value;
}

function matchesType(type: string, value: unknown): boolean {
  switch (type) {
    case 'integer':
      return Number.isInteger(value);
    case 'number':
      return typeof value === 'number';
    case 'array':
      return Array.isArray(value);
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    default:
      return typeof value === type;
  }
}

/** Every way `value` breaks `schema`, as `$.path: problem` lines; empty when it conforms. */
export function validateAgainstSchema(
  schema: ContractSchema,
  value: unknown,
  path = '$',
  schemas: Record<string, ContractSchema> = loadDocument().components.schemas,
): string[] {
  if (schema.$ref) {
    const target = schemas[schema.$ref.split('/').at(-1) ?? ''];
    return target ? validateAgainstSchema(target, value, path, schemas) : [`${path}: unknown schema ${schema.$ref}`];
  }
  if (value === null) {
    return schema.nullable || (!schema.type && !schema.properties) ? [] : [`${path}: is null but the API never sends null here`];
  }
  if (schema.allOf) {
    return schema.allOf.flatMap((part) => validateAgainstSchema(part, value, path, schemas));
  }
  const alternatives = schema.oneOf ?? schema.anyOf;
  if (alternatives) {
    const results = alternatives.map((option) => validateAgainstSchema(option, value, path, schemas));
    return results.some((errors) => errors.length === 0) ? [] : results.flat();
  }
  if (schema.enum && !schema.enum.includes(value)) {
    return [`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`];
  }
  if (schema.type && !matchesType(schema.type, value)) {
    return [`${path}: expected ${schema.type}, got ${describeValue(value)}`];
  }
  if (Array.isArray(value)) {
    return schema.items ? value.flatMap((item, index) => validateAgainstSchema(schema.items!, item, `${path}[${index}]`, schemas)) : [];
  }
  if (typeof value !== 'object' || !schema.properties) {
    return [];
  }
  const record = value as Record<string, unknown>;
  const missing = (schema.required ?? [])
    .filter((key) => record[key] === undefined)
    .map((key) => `${path}.${key}: missing`);
  const checked = Object.entries(record).flatMap(([key, child]) => {
    const childSchema = schema.properties![key];
    if (childSchema) return child === undefined ? [] : validateAgainstSchema(childSchema, child, `${path}.${key}`, schemas);
    return schema.additionalProperties ? [] : [`${path}.${key}: not in the API's response`];
  });
  return [...missing, ...checked];
}

/**
 * How a mock answer differs from what the API documents for that request, or an empty list when it
 * matches or the API documents no JSON body for it.
 */
export function checkMockResponse(method: string, pathname: string, status: number, body: unknown): string[] {
  const operation = loadOperations()
    .filter((candidate) => candidate.method === method && candidate.pattern.test(pathname))
    .sort((left, right) => right.literalSegments - left.literalSegments)[0];
  const schema = operation?.responses[String(status)];
  if (!schema) return [];
  return validateAgainstSchema(schema, JSON.parse(JSON.stringify(body)) as unknown).map(
    (problem) => `${method} ${pathname} ${status} ${problem}`,
  );
}

const violations: string[] = [];

/** Notes a mock answer that breaks the contract; the test fixture fails the test that received it. */
export function recordContractViolations(problems: string[]): void {
  violations.push(...problems);
}

/** The violations recorded since the last call, which clears them. */
export function takeContractViolations(): string[] {
  return violations.splice(0, violations.length);
}
