import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { enrichOpenApiExamples } from './swagger.examples';

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head']);
/** Operations that answer a file rather than JSON, so their success response documents no schema. */
const FILE_DOWNLOADS = new Set([
  'GET /api/config/download-data',
  'GET /api/io/export',
  'GET /api/attachments/file/{filename}',
  'GET /api/books/versions/{versionId}/download',
  'GET /api/books/export',
  'POST /api/books/export',
]);

describe('enrichOpenApiExamples', () => {
  it('adds examples to component schemas and JSON request and response bodies', () => {
    const document: OpenApiTestDocument = {
      paths: {
        '/entries': {
          post: {
            summary: 'Create entry',
            tags: ['Entries'],
            requestBody: {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CreateEntryDto' },
                },
              },
            },
            responses: {
              201: {
                description: 'Created entry',
                content: {
                  'application/json': {
                    schema: { $ref: '#/components/schemas/EntryDto' },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          CreateEntryDto: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              content: { type: 'string' },
              visibility: { type: 'string', enum: ['private', 'shared'] },
            },
          },
          EntryDto: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    };

    const result = enrichOpenApiExamples(document as never) as OpenApiTestDocument;

    expect(result.components.schemas.CreateEntryDto.example).toEqual({
      title: 'June reflections',
      content: 'Today I wrote a thoughtful journal entry about focus and calm.',
      visibility: 'private',
    });
    expect(result.paths['/entries'].post.requestBody!.content!['application/json'].example).toEqual(
      result.components.schemas.CreateEntryDto.example,
    );
    expect(result.paths['/entries'].post.responses![201].content!['application/json'].example).toEqual(
      result.components.schemas.EntryDto.example,
    );
  });
});

describe('exported OpenAPI document', () => {
  it('has operation metadata, a schema for every JSON success response, and examples for JSON bodies', () => {
    const openApiPath = join(process.cwd(), 'openapi', 'openapi.json');
    expect(existsSync(openApiPath)).toBe(true);

    const document = JSON.parse(readFileSync(openApiPath, 'utf8')) as {
      paths?: Record<string, Record<string, OpenApiOperation>>;
    };
    const failures: string[] = [];

    for (const [path, pathItem] of Object.entries(document.paths ?? {})) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!HTTP_METHODS.has(method)) {
          continue;
        }

        const label = `${method.toUpperCase()} ${path}`;
        if (!operation.summary) {
          failures.push(`${label} is missing a summary`);
        }
        if (!operation.tags?.length) {
          failures.push(`${label} is missing tags`);
        }
        if (!Object.keys(operation.responses ?? {}).length) {
          failures.push(`${label} is missing responses`);
        }

        assertJsonContentExamples(`${label} request body`, operation.requestBody?.content, failures);

        for (const [status, response] of Object.entries(operation.responses ?? {})) {
          if (!response.description) {
            failures.push(`${label} response ${status} is missing a description`);
          }
          assertJsonContentExamples(`${label} response ${status}`, response.content, failures);
          // The web types and the e2e mock contract check come from these schemas
          if (status.startsWith('2') && !response.content && !FILE_DOWNLOADS.has(label)) {
            failures.push(`${label} response ${status} documents no body schema`);
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });
});

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

interface OpenApiMediaType {
  schema?: unknown;
  example?: unknown;
}

interface OpenApiTestDocument {
  paths: Record<string, Record<string, OpenApiOperation>>;
  components: {
    schemas: Record<string, {
      example?: unknown;
      type?: string;
      properties?: Record<string, unknown>;
    }>;
  };
}

function assertJsonContentExamples(
  label: string,
  content: Record<string, OpenApiMediaType> | undefined,
  failures: string[],
): void {
  const jsonMediaType = content?.['application/json'];
  if (jsonMediaType?.schema && jsonMediaType.example === undefined) {
    failures.push(`${label} is missing an application/json example`);
  }
}
