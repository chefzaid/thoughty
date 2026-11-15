import type { components } from '../../src/generated/openapi';

import type { MockAppState } from './mockApp.shared';
import { fulfillApiError, fulfillJson, type RouteContext } from './mockApp.route-utils';

type ComposerDraft = components['schemas']['ComposerDraftResponseDto'];
type SaveComposerDraft = components['schemas']['SaveComposerDraftDto'];

/** The writer's composer draft, kept beside the mock state so every page sharing a state (each device) sees it. */
const drafts = new WeakMap<MockAppState, ComposerDraft>();

/** The draft the API holds for the mock writer, as another device left it. */
export function seedMockComposerDraft(state: MockAppState, draft: Partial<ComposerDraft> & Pick<ComposerDraft, 'text'>): ComposerDraft {
  const seeded: ComposerDraft = {
    title: null, tags: [], format: 'plain', mood: null, feelings: [], revision: 1, updatedAt: new Date().toISOString(), ...draft,
  };
  drafts.set(state, seeded);
  return seeded;
}

export function mockComposerDraft(state: MockAppState): ComposerDraft | null {
  return drafts.get(state) ?? null;
}

const conflict = (context: RouteContext) =>
  fulfillApiError(context.route, 409, 'COMPOSER_DRAFT_CONFLICT', 'The draft was changed on another device');

/**
 * `/api/composer-draft` as the API answers it: one draft per writer, each save on top of the revision the
 * device saw (null for none), any other refused with COMPOSER_DRAFT_CONFLICT, and a discard at a revision
 * that keeps a newer draft.
 */
export async function handleComposerDraftRoutes(context: RouteContext): Promise<boolean> {
  const { route, request, pathname, searchParams, state } = context;
  if (pathname !== '/api/composer-draft') return false;
  const current = drafts.get(state) ?? null;

  if (request.method() === 'GET') {
    await fulfillJson(route, { draft: current });
    return true;
  }

  if (request.method() === 'PUT') {
    const { baseRevision, ...fields } = request.postDataJSON() as SaveComposerDraft;
    if ((current?.revision ?? null) !== baseRevision) {
      await conflict(context);
      return true;
    }
    const saved: ComposerDraft = {
      ...fields,
      title: fields.title || null,
      revision: (current?.revision ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    drafts.set(state, saved);
    await fulfillJson(route, saved);
    return true;
  }

  if (request.method() === 'DELETE') {
    const revision = searchParams.get('revision');
    if (current && revision !== null && Number(revision) !== current.revision) {
      await conflict(context);
      return true;
    }
    drafts.delete(state);
    await fulfillJson(route, { success: true });
    return true;
  }

  return false;
}
