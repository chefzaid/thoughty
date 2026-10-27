import {
  describePostgres,
  POSTGRES_SETUP_TIMEOUT_MS,
} from '../../src/database/postgres-test-database.test-helpers';
import { startContractApi, type ContractApi } from './contract-app';
import { ContractClient, type ContractUser } from './contract-client';
import { CONTRACT_SUITES, type ContractSuiteName } from './contract-operations';

export const CONTRACT_PASSWORD = 'Contract1234!';

export interface ContractContext {
  api: ContractApi;
  client: ContractClient;
  /** The writer whose data the suite reads and changes. */
  alice: ContractUser;
  /** A second writer, to check each route keeps to the caller's own data. */
  bob: ContractUser;
}

/** The refresh cookie a sign-in sets, as the browser sends it back (`name=value`). */
export function readRefreshCookie(setCookie: string[] | string | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const cookie = cookies.find((value) => value.startsWith('thoughty_refresh_token='));
  if (!cookie) throw new Error('The API set no refresh token cookie');
  return cookie.split(';')[0] ?? '';
}

/** Registers a writer with the web's sign-up request: its fields, and the empty bot trap. */
export async function registerWriter(
  client: ContractClient,
  username: string,
): Promise<ContractUser> {
  const email = `${username}@example.com`;
  const response = await client.call('POST /api/auth/register', {
    json: { email, password: CONTRACT_PASSWORD, username, website: '' },
    status: 201,
  });
  const body = response.body as { user: { id: number }; accessToken: string };
  return {
    id: body.user.id,
    username,
    email,
    password: CONTRACT_PASSWORD,
    accessToken: body.accessToken,
    refreshCookie: readRefreshCookie(response.headers['set-cookie']),
  };
}

/**
 * A real-API contract suite: the whole API on a database of its own, with two registered writers.
 * After its tests it checks it called every operation `CONTRACT_SUITES[name]` lists.
 */
export function describeContract(
  name: ContractSuiteName,
  defineTests: (context: ContractContext) => void,
): void {
  describePostgres(`API contract: ${name}`, () => {
    const context = {} as ContractContext;

    beforeAll(async () => {
      context.api = await startContractApi();
      context.client = new ContractClient(context.api.http, () =>
        context.api.logger.lines.length > 0
          ? `\nAPI log:\n  ${context.api.logger.lines.slice(-5).join('\n  ')}`
          : '',
      );
      context.alice = await registerWriter(context.client, `alice_${name}`);
      context.bob = await registerWriter(context.client, `bob_${name}`);
    }, POSTGRES_SETUP_TIMEOUT_MS);

    afterAll(async () => {
      await context.api?.close();
    });

    defineTests(context);

    it('called every operation it covers', () => {
      const missed = CONTRACT_SUITES[name].filter(
        (operation) => !context.client.called.has(operation),
      );
      expect(missed).toEqual([]);
    });
  });
}
