import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Server } from 'node:http';
import request, { type Response } from 'supertest';
import {
  validateAgainstSchema,
  type ContractDocument,
  type ContractOperation,
} from '../../../thoughty-web/e2e/support/openapi-schema';
import type { ApiErrorCode } from '../../src/common/errors/api-error-codes';

export const openApiDocument = JSON.parse(
  readFileSync(join(__dirname, '../../openapi/openapi.json'), 'utf8'),
) as ContractDocument;

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

/** Every operation the contract documents, as `METHOD /api/path/{param}`. */
export function listContractOperations(document: ContractDocument = openApiDocument): string[] {
  return Object.entries(document.paths).flatMap(([path, methods]) =>
    Object.keys(methods)
      .filter((method): method is HttpMethod =>
        (HTTP_METHODS as readonly string[]).includes(method),
      )
      .map((method) => `${method.toUpperCase()} ${path}`),
  );
}

/** A signed-in writer: the access token the web keeps in memory and its refresh cookie. */
export interface ContractUser {
  id: number;
  username: string;
  email: string;
  password: string;
  accessToken: string;
  refreshCookie: string;
}

export interface UploadedFile {
  field: string;
  buffer: Buffer;
  filename: string;
  contentType: string;
}

export interface ContractRequest {
  /** Sent with `Authorization: Bearer <token>`, as the web's `authFetch` does. */
  as?: ContractUser;
  params?: Record<string, string | number>;
  /** Encoded with `URLSearchParams`, as the web builds every query string. */
  query?: URLSearchParams | Record<string, string>;
  /** Sent as `application/json`. */
  json?: unknown;
  /** Sent as `multipart/form-data` with its boundary, as a browser sends a `FormData`. */
  multipart?: { fields?: Record<string, string>; files?: UploadedFile[] };
  headers?: Record<string, string>;
  /** The status the call must answer. */
  status: number;
  /** For an error status: the `code` its body must carry. */
  code?: ApiErrorCode;
  /** For a file download: the content type it must be served with. */
  contentType?: RegExp;
  /** Keeps the body as the bytes received (a ZIP or a video), which supertest otherwise reads as text. */
  binary?: boolean;
}

function buildPath(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = params[name];
    if (value === undefined) throw new Error(`${template}: no value for {${name}}`);
    return encodeURIComponent(String(value));
  });
}

/**
 * Calls the running API the way the web does and checks each answer against `openapi/openapi.json`:
 * the status, a documented success status, its JSON body against the response schema (no field the
 * contract leaves out, no `null` it does not allow), a file's content type, and an error's `code`
 * against the `ApiErrorResponse` schema. It records each operation it called, so a suite can check it
 * reached every route it claims.
 */
export class ContractClient {
  readonly called = new Set<string>();

  constructor(
    private readonly http: Server,
    private readonly describeLogs: () => string = () => '',
  ) {}

  async call(operation: string, options: ContractRequest): Promise<Response> {
    const documented = this.findOperation(operation);
    const [method, template] = operation.split(' ') as [HttpMethod | Uppercase<HttpMethod>, string];
    const query = new URLSearchParams(options.query ?? {}).toString();
    const url = `${buildPath(template, options.params)}${query ? `?${query}` : ''}`;

    let pending = request(this.http)[method.toLowerCase() as HttpMethod](url);
    if (options.as) pending = pending.set('Authorization', `Bearer ${options.as.accessToken}`);
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      pending = pending.set(name, value);
    }
    if (options.multipart) {
      for (const [name, value] of Object.entries(options.multipart.fields ?? {})) {
        pending = pending.field(name, value);
      }
      for (const file of options.multipart.files ?? []) {
        pending = pending.attach(file.field, file.buffer, {
          filename: file.filename,
          contentType: file.contentType,
        });
      }
    } else if (options.json !== undefined) {
      pending = pending.send(options.json as object);
    }

    if (options.binary) {
      pending = pending.buffer(true).parse((stream, done) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => done(null, Buffer.concat(chunks)));
      });
    }

    const response = await pending;
    this.called.add(operation);
    const problems = this.check(operation, documented, options, response);
    if (problems.length > 0) {
      const body = response.text?.slice(0, 1500) ?? '';
      throw new Error(
        `${method} ${url} broke the contract:\n  ${problems.join('\n  ')}\nBody: ${body}${this.describeLogs()}`,
      );
    }
    return response;
  }

  private findOperation(operation: string): ContractOperation {
    const [method = '', path = ''] = operation.split(' ');
    const documented = openApiDocument.paths[path]?.[method.toLowerCase()];
    if (!documented) throw new Error(`${operation} is not in openapi/openapi.json`);
    return documented;
  }

  private check(
    operation: string,
    documented: ContractOperation,
    options: ContractRequest,
    response: Response,
  ): string[] {
    if (response.status !== options.status) {
      return [`answered ${response.status}, expected ${options.status}`];
    }
    const { schemas } = openApiDocument.components;
    if (response.status >= 400) {
      const problems = validateAgainstSchema(
        { $ref: '#/components/schemas/ApiErrorResponse' },
        response.body,
        schemas,
      );
      const code = (response.body as { code?: unknown }).code;
      if (!options.code) problems.push('an expected error code is required for an error status');
      else if (code !== options.code)
        problems.push(`code ${String(code)}, expected ${options.code}`);
      return problems;
    }
    const documentedResponse = documented.responses?.[String(response.status)];
    if (!documentedResponse) {
      return [`${operation} does not document status ${response.status}`];
    }
    const jsonSchema = documentedResponse.content?.['application/json']?.schema;
    const contentType = String(response.headers['content-type'] ?? '');
    if (options.contentType) {
      return options.contentType.test(contentType)
        ? []
        : [`served as ${contentType}, expected ${String(options.contentType)}`];
    }
    if (!jsonSchema) {
      return [`${operation} documents no JSON body for ${response.status}; pass contentType`];
    }
    if (!contentType.startsWith('application/json')) {
      return [`served as ${contentType || 'no content type'}, expected application/json`];
    }
    return validateAgainstSchema(jsonSchema, response.body, schemas);
  }
}
