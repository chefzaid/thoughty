import { requiredFeature } from './mockApp.contract';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';

/** The runtime feature flags the API has (`FeatureFlag` in thoughty-server's `feature-flags.service.ts`). */
export const MOCK_FEATURE_FLAGS = ['ai', 'bookConverter', 'cloudSync', 'publicSharing'] as const;
export type MockFeatureFlag = typeof MOCK_FEATURE_FLAGS[number];
/** The runtime feature flags the mock API answers; a flag left out is on, as the API documents. */
export type MockFeatureFlags = Partial<Record<MockFeatureFlag, boolean>>;

const isMockFeatureFlag = (flag: string | null): flag is MockFeatureFlag => MOCK_FEATURE_FLAGS.includes(flag as MockFeatureFlag);

interface BodyRule {
  readonly flag: MockFeatureFlag;
  readonly pattern: RegExp;
  readonly methods: readonly string[];
  readonly body: (payload: Record<string, unknown>) => boolean;
}

const makesPublic = (payload: Record<string, unknown>) => payload.visibility === 'public';

/**
 * Routes the API refuses for some bodies only, which its services check rather than `@RequireFeature`. The
 * routes `@RequireFeature` closes come from the contract (`requiredFeature`), so none can be left out here.
 */
const BODY_RULES: readonly BodyRule[] = [
  // Nothing becomes public while sharing is off
  { flag: 'publicSharing', pattern: /^\/api\/entries(\/bulk|\/\d+\/visibility)?$/, methods: ['POST', 'PATCH'], body: makesPublic },
];

function jsonBody(context: RouteContext): Record<string, unknown> {
  try {
    const payload: unknown = context.request.postDataJSON();
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Answers the flags, and refuses a switched-off feature's routes as the API does. */
export async function handleFeatureFlagRoutes(context: RouteContext): Promise<boolean> {
  const { route, request, pathname, state } = context;
  if (pathname === '/api/config/feature-flags') {
    await fulfillJson(route, { ...Object.fromEntries(MOCK_FEATURE_FLAGS.map((flag) => [flag, true])), ...state.featureFlags });
    return true;
  }

  const method = request.method();
  const gated = requiredFeature(method, pathname);
  const flag = isMockFeatureFlag(gated)
    ? gated
    : BODY_RULES.find((rule) => rule.pattern.test(pathname) && rule.methods.includes(method) && rule.body(jsonBody(context)))?.flag;
  if (!flag || state.featureFlags[flag] !== false) return false;

  state.featureDisabledRequests.push(`${method} ${pathname}`);
  await fulfillApiError(route, 503, 'FEATURE_DISABLED', `The ${flag} feature is turned off for now`);
  return true;
}
