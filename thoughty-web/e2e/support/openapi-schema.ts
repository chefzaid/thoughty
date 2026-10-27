/**
 * Checks a JSON value against an OpenAPI 3.0 schema of `thoughty-server/openapi/openapi.json`. It has
 * no imports, so both the e2e mock contract check (`mockApp.contract.ts`) and the server's real-API
 * contract specs (`thoughty-server/test/api-contract`) use it: the mock and the API are held to the
 * same reading of the contract.
 */

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

export interface ContractParameter {
  name: string;
  in: string;
  required?: boolean;
  schema?: ContractSchema;
}

export interface ContractMediaType {
  schema?: ContractSchema;
}

export interface ContractOperation {
  parameters?: ContractParameter[];
  requestBody?: { content?: Record<string, ContractMediaType> };
  responses?: Record<string, { content?: Record<string, ContractMediaType> }>;
  security?: unknown[];
}

export interface ContractDocument {
  paths: Record<string, Record<string, ContractOperation>>;
  components: { schemas: Record<string, ContractSchema> };
}

/** The schema a `$ref` such as `#/components/schemas/EntryDto` points at. */
export function resolveSchemaRef(
  ref: string,
  schemas: Record<string, ContractSchema>,
): ContractSchema | undefined {
  return schemas[ref.split('/').at(-1) ?? ''];
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

function validateObject(
  schema: ContractSchema,
  record: Record<string, unknown>,
  path: string,
  schemas: Record<string, ContractSchema>,
): string[] {
  const properties = schema.properties ?? {};
  const missing = (schema.required ?? [])
    .filter((key) => record[key] === undefined)
    .map((key) => `${path}.${key}: missing`);
  const checked = Object.entries(record).flatMap(([key, child]) => {
    const childSchema = properties[key];
    if (childSchema) {
      return child === undefined
        ? []
        : validateAgainstSchema(childSchema, child, schemas, `${path}.${key}`);
    }
    return schema.additionalProperties ? [] : [`${path}.${key}: not in the API's response`];
  });
  return [...missing, ...checked];
}

/**
 * Every way `value` breaks `schema`, as `$.path: problem` lines; empty when it conforms. A property
 * the schema does not list is a problem unless it allows `additionalProperties`, and `null` only
 * conforms where the schema says `nullable`.
 */
export function validateAgainstSchema(
  schema: ContractSchema,
  value: unknown,
  schemas: Record<string, ContractSchema>,
  path = '$',
): string[] {
  if (schema.$ref) {
    const target = resolveSchemaRef(schema.$ref, schemas);
    return target
      ? validateAgainstSchema(target, value, schemas, path)
      : [`${path}: unknown schema ${schema.$ref}`];
  }
  if (value === null) {
    return schema.nullable || (!schema.type && !schema.properties)
      ? []
      : [`${path}: is null but the API never sends null here`];
  }
  if (schema.allOf) {
    return schema.allOf.flatMap((part) => validateAgainstSchema(part, value, schemas, path));
  }
  const alternatives = schema.oneOf ?? schema.anyOf;
  if (alternatives) {
    const results = alternatives.map((option) => validateAgainstSchema(option, value, schemas, path));
    return results.some((errors) => errors.length === 0) ? [] : results.flat();
  }
  if (schema.enum && !schema.enum.includes(value)) {
    return [`${path}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`];
  }
  if (schema.type && !matchesType(schema.type, value)) {
    return [`${path}: expected ${schema.type}, got ${describeValue(value)}`];
  }
  if (Array.isArray(value)) {
    const items = schema.items;
    return items
      ? value.flatMap((item, index) => validateAgainstSchema(items, item, schemas, `${path}[${index}]`))
      : [];
  }
  if (typeof value !== 'object' || !schema.properties) {
    return [];
  }
  return validateObject(schema, value as Record<string, unknown>, path, schemas);
}
