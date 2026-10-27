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
  paths: Record<string, Record<string, {
    parameters?: { name: string; in: string; schema?: ContractSchema }[];
    requestBody?: { content?: Record<string, { schema?: ContractSchema }> };
    responses?: Record<string, { content?: Record<string, { schema?: ContractSchema }> }>;
  }>>;
  components: { schemas: Record<string, ContractSchema> };
}

interface Operation {
  method: string;
  pattern: RegExp;
  /** Literal path segments, so `/api/diaries/reorder` wins over `/api/diaries/{id}`. */
  literalSegments: number;
  /** The media types the operation accepts a body in, such as `multipart/form-data` for an upload. */
  requestTypes: string[];
  /** The schema of the JSON body the operation takes, if any. */
  jsonRequest?: ContractSchema;
  /** The documented type of each query parameter, such as `boolean` for `narrative`. */
  queryTypes: Record<string, string | undefined>;
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
      requestTypes: Object.keys(operation.requestBody?.content ?? {}),
      jsonRequest: operation.requestBody?.content?.['application/json']?.schema,
      queryTypes: Object.fromEntries(
        (operation.parameters ?? []).filter((parameter) => parameter.in === 'query').map((parameter) => [parameter.name, parameter.schema?.type]),
      ),
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
  const schema = findOperation(method, pathname)?.responses[String(status)];
  if (!schema) return [];
  return validateAgainstSchema(schema, JSON.parse(JSON.stringify(body)) as unknown).map(
    (problem) => `${method} ${pathname} ${status} ${problem}`,
  );
}

function findOperation(method: string, pathname: string): Operation | undefined {
  return loadOperations()
    .filter((candidate) => candidate.method === method && candidate.pattern.test(pathname))
    .sort((left, right) => right.literalSegments - left.literalSegments)[0];
}

/**
 * Why the API would refuse this upload before reading it, or null: a body sent to an operation that takes only
 * `multipart/form-data` under another content type (the API's JSON parser fails on it, so the file never
 * arrives), or without the multipart boundary the browser adds when it sets the type itself.
 */
export function checkMultipartRequest(method: string, pathname: string, contentType: string | undefined, hasBody: boolean): string | null {
  const requestTypes = findOperation(method, pathname)?.requestTypes ?? [];
  if (!hasBody || requestTypes.length === 0 || requestTypes.some((type) => type !== 'multipart/form-data')) return null;
  const type = contentType?.toLowerCase() ?? '';
  if (!type.startsWith('multipart/form-data')) {
    return `${method} ${pathname} sends its multipart body as ${contentType ?? 'no content type'}`;
  }
  return /;\s*boundary=/.test(type) ? null : `${method} ${pathname} sends multipart/form-data without its boundary`;
}

const QUERY_BOOLEANS = ['true', 'false', '1', '0'];
const QUERY_INTEGER = /^-?\d+$/;

/**
 * Why the API would refuse this query string, or an empty list: like its `@StrictBoolean()` and `@StrictInt()`
 * (docs/development.md), a boolean must be sent once as true, false, 1 or 0 and a number once as whole digits.
 */
export function checkQueryParameters(method: string, pathname: string, searchParams: URLSearchParams): string[] {
  const queryTypes = findOperation(method, pathname)?.queryTypes ?? {};
  return Object.entries(queryTypes).flatMap(([name, type]) => {
    const values = searchParams.getAll(name);
    if (values.length === 0 || (type !== 'boolean' && type !== 'number' && type !== 'integer')) return [];
    const valid = values.length === 1 && (type === 'boolean' ? QUERY_BOOLEANS.includes(values[0]!) : QUERY_INTEGER.test(values[0]!));
    return valid ? [] : [`${method} ${pathname} sends ${name}=${values.join('&')}, which the API refuses as a ${type}`];
  });
}

const JSON_BOOLEANS: readonly unknown[] = [true, false, 1, 0, 'true', 'false', '1', '0'];

function isWholeNumber(value: unknown): boolean {
  return Number.isInteger(value) || (typeof value === 'string' && QUERY_INTEGER.test(value));
}

/** Every way a JSON request `value` breaks the types the API reads in `schema`, as `$.path: problem` lines. */
function requestTypeProblems(schema: ContractSchema, value: unknown, path: string, schemas: Record<string, ContractSchema>): string[] {
  if (schema.$ref) {
    const target = schemas[schema.$ref.split('/').at(-1) ?? ''];
    return target ? requestTypeProblems(target, value, path, schemas) : [];
  }
  if (value === null || value === undefined) return [];
  if (schema.allOf) return schema.allOf.flatMap((part) => requestTypeProblems(part, value, path, schemas));
  const alternatives = schema.oneOf ?? schema.anyOf;
  if (alternatives) {
    const results = alternatives.map((option) => requestTypeProblems(option, value, path, schemas));
    return results.some((problems) => problems.length === 0) ? [] : results.flat();
  }
  const sent = JSON.stringify(value);
  switch (schema.type) {
    case 'string':
      return typeof value === 'string' ? [] : [`${path}: expected a string, got ${sent}`];
    case 'number':
    case 'integer':
      return isWholeNumber(value) ? [] : [`${path}: expected a whole number, got ${sent}`];
    case 'boolean':
      return JSON_BOOLEANS.includes(value) ? [] : [`${path}: expected true, false, 1 or 0, got ${sent}`];
    case 'array':
      if (!Array.isArray(value)) return [`${path}: expected an array, got ${sent}`];
      return schema.items ? value.flatMap((item, index) => requestTypeProblems(schema.items!, item, `${path}[${index}]`, schemas)) : [];
    default:
      break;
  }
  if (!schema.properties) return [];
  if (typeof value !== 'object' || Array.isArray(value)) return [`${path}: expected an object, got ${sent}`];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const childSchema = schema.properties![key];
    if (childSchema) return requestTypeProblems(childSchema, child, `${path}.${key}`, schemas);
    return schema.additionalProperties ? [] : [`${path}.${key}: not a property the API takes`];
  });
}

/**
 * Why the API would refuse this JSON body for its types, or an empty list. Its global pipe converts nothing
 * (docs/development.md › Request validation), so a string must be sent as a string, a boolean as
 * `@StrictBoolean()` reads it and a number as `@StrictInt()` does (a whole number or plain digits), and a
 * property the DTO does not declare is refused. Ranges, formats and required fields are left to the mock.
 */
export function checkJsonRequestBody(method: string, pathname: string, body: unknown): string[] {
  const schema = findOperation(method, pathname)?.jsonRequest;
  if (!schema) return [];
  return requestTypeProblems(schema, body, '$', loadDocument().components.schemas).map((problem) => `${method} ${pathname} sends ${problem}`);
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
