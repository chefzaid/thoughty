import type { components } from '../../src/generated/openapi';

import { fulfillJson, type RouteContext } from './mockApp.route-utils';
import type { MockAppState, MockEntry } from './mockApp.shared';
import { authorId } from './mockApp.social-shared';

type FollowedUser = components['schemas']['FollowedUserDto'];

/**
 * Followers by approval in the mock API. `approvingAuthorIds` are the other writers who approve their followers:
 * following one of them sends a request (`requestedUserIds`) until the spec approves it, and their entries reach
 * the reader as teasers until then. `required` and `requests` are the reader's own switch and the requests to
 * follow them.
 */
export interface MockFollowApprovalState {
  required: boolean;
  requests: FollowedUser[];
  approvingAuthorIds: number[];
  requestedUserIds: number[];
}

export function createMockFollowApprovalState(options: Partial<MockFollowApprovalState> = {}): MockFollowApprovalState {
  return {
    required: options.required ?? false,
    requests: [...(options.requests || [])],
    approvingAuthorIds: [...(options.approvingAuthorIds || [])],
    requestedUserIds: [...(options.requestedUserIds || [])],
  };
}

const followState = (userId: number, following: boolean, requested = false) => ({ userId, following, requested });

/** Whether the reader sees only a teaser of the entry: its writer approves followers and has not approved them. */
export function isTeaser(entry: MockEntry, state: MockAppState): boolean {
  const id = authorId(entry, state);
  return id !== state.user.id
    && state.followApproval.approvingAuthorIds.includes(id)
    && !state.followedUserIds.includes(id);
}

/** The author fields the feed gives about following them. */
export function authorFollowFields(id: number, state: MockAppState) {
  return {
    isFollowed: state.followedUserIds.includes(id),
    followRequested: state.followApproval.requestedUserIds.includes(id),
    approvalRequired: state.followApproval.approvingAuthorIds.includes(id),
  };
}

/** A teaser keeps only who wrote the entry, its day and its title. */
export function toTeaser<T extends { tags: string[]; content: string }>(entry: T): T {
  return {
    ...entry,
    timeOfDay: null,
    tags: [],
    content: '',
    format: 'plain',
    commentCount: 0,
    likeCount: 0,
    liked: false,
    locked: true,
  };
}

/** Following a writer who approves their followers sends a request instead. */
export function followWriter(state: MockAppState, userId: number) {
  if (state.followedUserIds.includes(userId)) return followState(userId, true);
  if (state.followApproval.approvingAuthorIds.includes(userId)) {
    if (!state.followApproval.requestedUserIds.includes(userId)) state.followApproval.requestedUserIds.push(userId);
    return followState(userId, false, true);
  }
  state.followedUserIds.push(userId);
  return followState(userId, true);
}

export function unfollowWriter(state: MockAppState, userId: number) {
  state.followedUserIds = state.followedUserIds.filter((id) => id !== userId);
  state.followApproval.requestedUserIds = state.followApproval.requestedUserIds.filter((id) => id !== userId);
  return followState(userId, false);
}

/** Declining a request, removing a follower or a block takes the writer out of the requests to follow the reader. */
export function dropRequest(state: MockAppState, userId: number) {
  state.followApproval.requests = state.followApproval.requests.filter((user) => user.id !== userId);
}

/** `PUT /api/follows/approval` and `PUT /api/follows/followers/:userId`. */
export async function handleFollowApprovalRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (request.method() !== 'PUT') return false;
  const approval = state.followApproval;
  if (pathname === '/api/follows/approval') {
    const { required } = request.postDataJSON() as { required: boolean };
    approval.required = required;
    const approved = required ? 0 : approval.requests.length;
    if (!required) {
      state.writers.followers.push(...approval.requests);
      state.followerCount += approved;
      approval.requests = [];
    }
    await fulfillJson(route, { required, approved });
    return true;
  }

  const match = /^\/api\/follows\/followers\/(\d+)$/.exec(pathname);
  if (!match) return false;
  const userId = Number(match[1]);
  const asking = approval.requests.find((user) => user.id === userId);
  if (asking) {
    dropRequest(state, userId);
    state.writers.followers.push(asking);
    state.followerCount += 1;
  } else if (!state.writers.followers.some((user) => user.id === userId)) {
    await fulfillJson(
      route,
      { message: 'This writer has not asked to follow you', statusCode: 404, code: 'FOLLOW_REQUEST_NOT_FOUND' },
      { status: 404 },
    );
    return true;
  }
  await fulfillJson(route, followState(userId, true));
  return true;
}
