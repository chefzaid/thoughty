import {
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
} from '../../src/database/postgres-test-database.test-helpers';
import { startContractApi, type ContractApi } from './contract-app';
import { ContractClient, listContractOperations, openApiDocument } from './contract-client';

/** The operations documented as needing the bearer access token, with a value for each path parameter. */
function bearerOperations(): { operation: string; params: Record<string, string> }[] {
  return listContractOperations()
    .filter((operation) => {
      const [method = '', path = ''] = operation.split(' ');
      const security = openApiDocument.paths[path]?.[method.toLowerCase()]?.security ?? [];
      return security.some((requirement) => 'bearer' in (requirement as Record<string, unknown>));
    })
    .map((operation) => ({
      operation,
      params: Object.fromEntries(
        [...operation.matchAll(/\{([^}]+)\}/g)].map(([, name]) => [name!, '1']),
      ),
    }));
}

describePostgres('API contract: guards', () => {
  let api: ContractApi;
  let client: ContractClient;

  beforeAll(async () => {
    api = await startContractApi();
    client = new ContractClient(api.http);
  }, POSTGRES_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await api?.close();
  });

  it('documents most routes as signed-in only', () => {
    expect(bearerOperations().length).toBeGreaterThan(130);
  });

  // The global JWT guard runs before the validation pipe, so even an empty request is refused as unauthenticated
  it.each(bearerOperations())(
    '$operation refuses a request without an access token',
    async ({ operation, params }) => {
      await client.call(operation, { params, status: 401, code: 'UNAUTHORIZED' });
    },
  );

  it('refuses an expired or forged access token', async () => {
    const forged = {
      id: 1,
      username: 'x',
      email: 'x@example.com',
      password: '',
      accessToken: 'not.a.jwt',
      refreshCookie: '',
    };
    await client.call('GET /api/entries', { as: forged, status: 401, code: 'UNAUTHORIZED' });
  });
});
