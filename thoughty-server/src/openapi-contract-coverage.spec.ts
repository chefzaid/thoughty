import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONTRACT_SUITES } from '../test/api-contract/contract-operations';

interface OpenApiTestDocument {
  paths: Record<string, Record<string, { security?: Record<string, unknown>[] }>>;
  components: { securitySchemes?: Record<string, unknown> };
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);
const document = JSON.parse(
  readFileSync(join(__dirname, '../openapi/openapi.json'), 'utf8'),
) as OpenApiTestDocument;

const documentedOperations = Object.entries(document.paths).flatMap(([path, methods]) =>
  Object.keys(methods)
    .filter((method) => HTTP_METHODS.has(method))
    .map((method) => `${method.toUpperCase()} ${path}`),
);

/**
 * The real-API contract specs (`test/api-contract`, run with PostgreSQL) call every documented
 * route. This check runs without a database, so a route added without a contract test fails here.
 */
describe('real-API contract coverage', () => {
  const listed: string[] = Object.values(CONTRACT_SUITES).flat();

  it('lists every documented operation in a contract suite', () => {
    expect(documentedOperations.filter((operation) => !listed.includes(operation))).toEqual([]);
  });

  it('lists only documented operations, each in one suite', () => {
    expect(listed.filter((operation) => !documentedOperations.includes(operation))).toEqual([]);
    expect(listed.filter((operation, index) => listed.indexOf(operation) !== index)).toEqual([]);
  });

  // Swagger UI sends a token only for a scheme the document defines
  it('names only defined security schemes', () => {
    const schemes = Object.keys(document.components.securitySchemes ?? {});
    const undefinedSchemes = Object.entries(document.paths).flatMap(([path, methods]) =>
      Object.entries(methods).flatMap(([method, operation]) =>
        (operation.security ?? [])
          .flatMap((requirement) => Object.keys(requirement))
          .filter((scheme) => !schemes.includes(scheme))
          .map((scheme) => `${method.toUpperCase()} ${path}: ${scheme}`),
      ),
    );
    expect(undefinedSchemes).toEqual([]);
  });
});
