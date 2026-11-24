import request from 'supertest';
import { ADDRESS_CEILING_FACTOR, RATE_LIMITS } from '../../src/common/rate-limit.constants';
import { describeContract, registerWriter } from './contract-suite';
import type { ContractUser } from './contract-client';

const { limit } = RATE_LIMITS.default;
// Generous: each test sends a few hundred requests through the whole API
const MANY_REQUESTS_TIMEOUT_MS = 60_000;

/**
 * The global rate limit as a deployment counts it, behind one trusted proxy (`TRUST_PROXY=1`) that says
 * each client's address in `X-Forwarded-For`: per account when signed in, under a ceiling per address,
 * and per address when signed out.
 */
describeContract(
  'rate-limits',
  (context) => {
    let carol: ContractUser;
    let dave: ContractUser;

    beforeAll(async () => {
      carol = await registerWriter(context.client, 'carol_rate_limits');
      dave = await registerWriter(context.client, 'dave_rate_limits');
    });

    /** `path` from `address`, as `user` (or signed out), sent `times` times; the answers' statuses and the last answer. */
    async function send(path: string, address: string, user: ContractUser | null, times = 1) {
      const statuses: number[] = [];
      let last: request.Response | undefined;
      for (let sent = 0; sent < times; sent += 1) {
        const call = request(context.api.http).get(path).set('X-Forwarded-For', address);
        last = await (user ? call.set('Authorization', `Bearer ${user.accessToken}`) : call);
        statuses.push(last.status);
      }
      return { statuses, last: last! };
    }

    function expectRefused(response: request.Response) {
      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({ code: 'RATE_LIMITED' });
      expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    }

    it('gives each signed-in writer at one address a budget of their own', async () => {
      const { alice, bob } = context;
      const office = '203.0.113.20';
      expect(new Set((await send('/api/config', office, alice, limit)).statuses)).toEqual(new Set([200]));
      expectRefused((await send('/api/config', office, alice)).last);
      // Alice's budget is the account's, from any address
      expectRefused((await send('/api/config', '198.51.100.20', alice)).last);

      // Bob, at the same address, reads his on a count of his own
      expect((await send('/api/config', office, bob)).last.status).toBe(200);
    }, MANY_REQUESTS_TIMEOUT_MS);

    it('caps every account at one address at the address ceiling', async () => {
      const { alice, bob } = context;
      const school = '203.0.113.30';
      expect(ADDRESS_CEILING_FACTOR).toBe(3);
      for (const writer of [alice, bob, carol]) {
        expect(new Set((await send('/api/diaries', school, writer, limit)).statuses)).toEqual(new Set([200]));
      }

      // Dave has his whole budget left, yet the school's address has used up its ceiling
      expectRefused((await send('/api/diaries', school, dave)).last);
      // From another address he reads at once: the ceiling is the address's, keyed on the address the proxy says
      expect((await send('/api/diaries', '198.51.100.30', dave)).last.status).toBe(200);
    }, MANY_REQUESTS_TIMEOUT_MS);

    it('counts signed-out requests per address, at the route\'s limit', async () => {
      const cafe = '203.0.113.40';
      const signedOut = (address: string) =>
        // A token on a public route is not verified, so it never makes the request an account's
        request(context.api.http).get('/api/memoir/questions').set('X-Forwarded-For', address).set('Authorization', 'Bearer forged');
      for (let sent = 0; sent < limit; sent += 1) {
        expect((await signedOut(cafe)).status).toBe(200);
      }
      expectRefused(await signedOut(cafe));

      expect((await signedOut('198.51.100.40')).status).toBe(200);
      // A public route verifies no token, so even a valid one counts against the address
      expectRefused((await send('/api/memoir/questions', cafe, dave)).last);
    }, MANY_REQUESTS_TIMEOUT_MS);
  },
  { env: { TRUST_PROXY: '1' } },
);
