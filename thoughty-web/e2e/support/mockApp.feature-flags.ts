import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';

export type MockFeatureFlag = 'ai' | 'bookConverter' | 'cloudSync' | 'publicSharing';
/** The runtime feature flags the mock API answers; a flag left out is on, as the API documents. */
export type MockFeatureFlags = Partial<Record<MockFeatureFlag, boolean>>;

interface FeatureRule {
  readonly flag: MockFeatureFlag;
  readonly pattern: RegExp;
  readonly methods?: readonly string[];
  /** For a route refused only for some bodies, such as an entry made public. */
  readonly body?: (payload: Record<string, unknown>) => boolean;
}

const makesPublic = (payload: Record<string, unknown>) => payload.visibility === 'public';

/** The routes the real API refuses with 503 FEATURE_DISABLED while a flag is off (`@RequireFeature`). */
const FEATURE_RULES: readonly FeatureRule[] = [
  { flag: 'ai', pattern: /^\/api\/ai\/(?!credentials$)/ },
  { flag: 'ai', pattern: /^\/api\/ai\/credentials$/, methods: ['PUT'] },
  { flag: 'ai', pattern: /^\/api\/attachments\/\d+\/transcribe$/ },
  { flag: 'ai', pattern: /^\/api\/review\/mood$/ },
  { flag: 'ai', pattern: /^\/api\/stats\/personality-analysis$/ },
  { flag: 'bookConverter', pattern: /^\/api\/books(\/|$)/ },
  { flag: 'cloudSync', pattern: /^\/api\/cloud-sync\/(?!disconnect$)/ },
  { flag: 'publicSharing', pattern: /^\/api\/entries\/feed$/ },
  { flag: 'publicSharing', pattern: /^\/api\/entries\/\d+\/(comments|like)/ },
  { flag: 'publicSharing', pattern: /^\/api\/(follows|leaderboard)(\/|$)/ },
  { flag: 'publicSharing', pattern: /^\/api\/shared\// },
  { flag: 'publicSharing', pattern: /^\/api\/share-links$/, methods: ['POST'] },
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
    await fulfillJson(route, { ai: true, bookConverter: true, cloudSync: true, publicSharing: true, ...state.featureFlags });
    return true;
  }

  const method = request.method();
  const refused = FEATURE_RULES.find((rule) =>
    state.featureFlags[rule.flag] === false
    && rule.pattern.test(pathname)
    && (!rule.methods || rule.methods.includes(method))
    && (!rule.body || rule.body(jsonBody(context))));
  if (!refused) return false;

  state.featureDisabledRequests.push(`${method} ${pathname}`);
  await fulfillApiError(route, 503, 'FEATURE_DISABLED', `The ${refused.flag} feature is turned off for now`);
  return true;
}
