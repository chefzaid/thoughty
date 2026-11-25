import { hostname } from 'node:os';
import {
  UNLEASH_APP_NAME,
  fetchUnleashToggles,
  readUnleashToggles,
  unleashFeaturesUrl,
} from './unleash-feature-flags';

const KNOWN = ['ai', 'bookConverter', 'cloudSync', 'publicSharing'];
const standard = { name: 'default', parameters: {}, constraints: [] };
const rollout = (percent: number | string) => ({
  name: 'flexibleRollout',
  parameters: { rollout: percent, stickiness: 'default', groupId: 'ai' },
  constraints: [],
});
const answer = (features: unknown[]) => ({ version: 2, features });

describe('unleashFeaturesUrl', () => {
  it.each([
    ['http://thoughty-unleash:4242/api', 'http://thoughty-unleash:4242/api/client/features'],
    ['http://thoughty-unleash:4242/api/', 'http://thoughty-unleash:4242/api/client/features'],
    ['http://thoughty-unleash:4242', 'http://thoughty-unleash:4242/api/client/features'],
    [' https://flags.example/unleash/ ', 'https://flags.example/unleash/api/client/features'],
  ])('reads %s as %s', (apiUrl, expected) => {
    expect(unleashFeaturesUrl(apiUrl)).toBe(expected);
  });
});

describe('readUnleashToggles', () => {
  it('maps enabled and disabled toggles to the flags of the same name', () => {
    expect(readUnleashToggles(answer([
      { name: 'ai', enabled: false, strategies: [standard] },
      { name: 'cloudSync', enabled: true, strategies: [standard] },
    ]), KNOWN)).toEqual({ ai: false, cloudSync: true });
  });

  it('ignores toggles that are not flags of the app, and leaves out flags with no toggle', () => {
    expect(readUnleashToggles(answer([
      { name: 'otherAppToggle', enabled: false, strategies: [] },
      { name: 'publicsharing', enabled: false, strategies: [] },
      { name: 'bookConverter', enabled: 'yes' },
      null,
      { enabled: false },
      { name: 'publicSharing', enabled: false, strategies: [] },
    ]), KNOWN)).toEqual({ publicSharing: false });
  });

  it('reads an enabled toggle without strategies as on', () => {
    expect(readUnleashToggles(answer([{ name: 'ai', enabled: true }]), KNOWN)).toEqual({ ai: true });
  });

  it('reads a gradual rollout at 100% as on, and any smaller rollout as off', () => {
    expect(readUnleashToggles(answer([
      { name: 'ai', enabled: true, strategies: [rollout(100)] },
      { name: 'cloudSync', enabled: true, strategies: [rollout('100')] },
      { name: 'bookConverter', enabled: true, strategies: [rollout(50)] },
      { name: 'publicSharing', enabled: true, strategies: [rollout(0)] },
    ]), KNOWN)).toEqual({ ai: true, cloudSync: true, bookConverter: false, publicSharing: false });
  });

  it('does not count strategies it cannot evaluate for every writer', () => {
    expect(readUnleashToggles(answer([
      { name: 'ai', enabled: true, strategies: [{ name: 'userWithId', parameters: { userIds: '1' } }] },
      {
        name: 'cloudSync',
        enabled: true,
        strategies: [{ ...standard, constraints: [{ contextName: 'userId', operator: 'IN', values: ['1'] }] }],
      },
      { name: 'bookConverter', enabled: true, strategies: [{ ...standard, segments: [3] }] },
      { name: 'publicSharing', enabled: true, strategies: [{ ...standard, disabled: true }, null] },
    ]), KNOWN)).toEqual({ ai: false, cloudSync: false, bookConverter: false, publicSharing: false });
  });

  it('reads a toggle as on when any one of its strategies is on for everyone', () => {
    expect(readUnleashToggles(answer([
      { name: 'ai', enabled: true, strategies: [rollout(10), { name: 'remoteAddress' }, standard] },
    ]), KNOWN)).toEqual({ ai: true });
  });

  it.each([[null], [{}], [{ features: 'ai' }], [[]]])('refuses an answer without a features list (%p)', (payload) => {
    expect(() => readUnleashToggles(payload, KNOWN)).toThrow('Unleash answered without a features list');
  });
});

describe('fetchUnleashToggles', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('asks the client API with the bare token, the app name and the instance', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(answer([{ name: 'ai', enabled: false, strategies: [standard] }])),
    );
    const signal = AbortSignal.timeout(1_000);

    await expect(fetchUnleashToggles(
      { apiUrl: 'http://thoughty-unleash:4242/api', token: 'default:production.secret', signal },
      KNOWN,
    )).resolves.toEqual({ ai: false });

    expect(fetchMock).toHaveBeenCalledWith('http://thoughty-unleash:4242/api/client/features', {
      headers: {
        Accept: 'application/json',
        'UNLEASH-APPNAME': UNLEASH_APP_NAME,
        'UNLEASH-INSTANCEID': hostname(),
        Authorization: 'default:production.secret',
      },
      signal,
    });
  });

  it('sends no Authorization header without a token', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(answer([])));

    await fetchUnleashToggles({ apiUrl: 'http://unleash/api', signal: AbortSignal.timeout(1_000) }, KNOWN);

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers).not.toHaveProperty('Authorization');
  });

  it('fails on an error status, without the token in the message', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));

    const failure = await fetchUnleashToggles(
      { apiUrl: 'http://unleash/api', token: 'default:production.secret', signal: AbortSignal.timeout(1_000) },
      KNOWN,
    ).catch((error: unknown) => error as Error);

    expect(failure).toEqual(new Error('Unleash returned 401'));
    expect(failure.message).not.toContain('secret');
  });
});
