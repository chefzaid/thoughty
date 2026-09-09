type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface OpenApiSchema {
  $ref?: string;
  allOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
  type?: string;
  format?: string;
  enum?: JsonValue[];
  default?: JsonValue;
  example?: JsonValue;
  properties?: Record<string, OpenApiSchema>;
  items?: OpenApiSchema;
  additionalProperties?: boolean | OpenApiSchema;
  nullable?: boolean;
}

interface OpenApiMediaType {
  schema?: OpenApiSchema;
  example?: JsonValue;
}

interface OpenApiOperation {
  summary?: string;
  tags?: string[];
  requestBody?: {
    content?: Record<string, OpenApiMediaType>;
  };
  responses?: Record<string, {
    description?: string;
    content?: Record<string, OpenApiMediaType>;
  }>;
}

interface OpenApiDocument {
  paths?: Record<string, unknown>;
  components?: {
    schemas?: Record<string, OpenApiSchema>;
  };
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);

export function enrichOpenApiExamples<T extends OpenApiDocument>(document: T): T {
  const schemas = document.components?.schemas ?? {};

  for (const [name, schema] of Object.entries(schemas)) {
    schema.example ??= buildExample(schema, schemas, name);
  }

  for (const pathItem of Object.values(document.paths ?? {})) {
    if (!isJsonObject(pathItem)) {
      continue;
    }

    for (const [method, operation] of Object.entries(pathItem)) {
      if (!HTTP_METHODS.has(method)) {
        continue;
      }

      const operationObject = operation as OpenApiOperation;
      addContentExamples(operationObject.requestBody?.content, schemas);

      for (const response of Object.values(operationObject.responses ?? {})) {
        addContentExamples(response.content, schemas);
      }
    }
  }

  return document;
}

function addContentExamples(content: Record<string, OpenApiMediaType> | undefined, schemas: Record<string, OpenApiSchema>): void {
  const mediaType = content?.['application/json'];
  if (!mediaType?.schema || mediaType.example !== undefined) {
    return;
  }

  mediaType.example = buildExample(mediaType.schema, schemas);
}

function buildExample(
  schema: OpenApiSchema | undefined,
  schemas: Record<string, OpenApiSchema>,
  propertyName = 'value',
  seen = new Set<string>(),
): JsonValue {
  if (!schema) {
    return inferScalarExample(propertyName);
  }

  if (schema.example !== undefined) {
    return schema.example;
  }

  if (schema.default !== undefined) {
    return schema.default;
  }

  if (schema.$ref) {
    return buildReferenceExample(schema.$ref, schemas, propertyName, seen);
  }

  const composed = schema.allOf ?? schema.anyOf ?? schema.oneOf;
  if (composed?.length) {
    const examples = composed.map((item) => buildExample(item, schemas, propertyName, seen));
    const objectExamples = examples.filter(isJsonObject);
    if (objectExamples.length) {
      return Object.assign({}, ...objectExamples);
    }
    return examples[0];
  }

  if (schema.enum?.length) {
    return schema.enum[0];
  }

  if (schema.type === 'array') {
    return [buildExample(schema.items, schemas, singularize(propertyName), seen)];
  }

  if (schema.type === 'object' || schema.properties) {
    return buildObjectExample(schema, schemas, propertyName, seen);
  }

  if (schema.type === 'boolean') {
    return true;
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    return inferNumberExample(propertyName);
  }

  if (schema.format === 'date-time') {
    return '2026-06-24T10:00:00.000Z';
  }

  if (schema.format === 'date') {
    return '2026-06-24';
  }

  return inferScalarExample(propertyName);
}

function inferScalarExample(propertyName: string): JsonValue {
  const normalized = propertyName.toLowerCase();

  const examples: Array<[boolean, JsonValue]> = [
    [normalized.includes('email'), 'user@example.com'],
    [normalized.includes('password'), 'Password123!'],
    [normalized.includes('token'), 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'],
    [normalized.includes('url') || normalized.includes('uri'), 'https://thoughty.example.com/callback'],
    [normalized.includes('date'), '2026-06-24'],
    [normalized.includes('time') || normalized.endsWith('at'), '2026-06-24T10:00:00.000Z'],
    [normalized.includes('color'), '#2A9D8F'],
    [normalized.includes('icon'), 'journal'],
    [normalized.includes('provider'), 'google_drive'],
    [normalized.includes('format'), 'markdown'],
    [normalized.includes('visibility'), 'private'],
    [normalized.includes('frequency'), 'daily'],
    [normalized.includes('role'), 'user'],
    [normalized.includes('content'), 'Today I wrote a thoughtful journal entry about focus and calm.'],
    [normalized.includes('tag'), 'reflection'],
    [normalized.includes('name'), 'Daily Journal'],
    [normalized.includes('title'), 'June reflections'],
    [normalized.includes('status'), 'ok'],
  ];
  return examples.find(([matches]) => matches)?.[1] ?? 'example';
}

function inferNumberExample(propertyName: string): number {
  const normalized = propertyName.toLowerCase();
  if (normalized.includes('count')) return 3;
  if (normalized.includes('page') || normalized.includes('limit')) return 1;
  if (normalized.includes('year')) return 2026;
  if (normalized.includes('month')) return 6;
  return 1;
}

function inferMapKey(propertyName: string): string {
  const normalized = propertyName.toLowerCase();
  if (normalized.includes('month')) return '2026-06';
  if (normalized.includes('year')) return '2026';
  if (normalized.includes('day') || normalized.includes('date')) return '2026-06-24';
  if (normalized.includes('tag')) return 'reflection';
  return 'example';
}

function singularize(propertyName: string): string {
  return propertyName.endsWith('s') ? propertyName.slice(0, -1) : propertyName;
}

function isJsonObject(value: unknown): value is { [key: string]: JsonValue } {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function buildObjectExample(schema: OpenApiSchema, schemas: Record<string, OpenApiSchema>, propertyName: string, seen: Set<string>): JsonValue {
  const properties = schema.properties ?? {};
  if (Object.keys(properties).length > 0) {
    return Object.fromEntries(
      Object.entries(properties).map(([name, propertySchema]) => [name, buildExample(propertySchema, schemas, name, seen)]),
    );
  }

  if (schema.additionalProperties && schema.additionalProperties !== true) {
    return { [inferMapKey(propertyName)]: buildExample(schema.additionalProperties, schemas, propertyName, seen) };
  }

  return { [inferMapKey(propertyName)]: inferScalarExample(propertyName) };
}

function buildReferenceExample(ref: string, schemas: Record<string, OpenApiSchema>, propertyName: string, seen: Set<string>): JsonValue {
  const refName = ref.split('/').at(-1) ?? propertyName;
  if (seen.has(refName)) {
    return inferScalarExample(refName);
  }

  const nextSeen = new Set(seen);
  nextSeen.add(refName);
  return buildExample(schemas[refName], schemas, refName, nextSeen);
}
