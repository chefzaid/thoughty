import { randomBytes } from "node:crypto";
import type { components } from "../../src/generated/openapi";
import type { MockAppState } from "./mockApp.shared";
import { fulfillApiError, fulfillJson, type RouteContext } from "./mockApp.route-utils";
import { MOCK_PNG } from "./mockApp.routes.attachments";
import { isMockSealed } from "./mockApp.routes.time-capsules";

type ShareLinkResponse = components["schemas"]["ShareLinkResponseDto"];
type ShareLinkDraft = components["schemas"]["CreateShareLinkDto"];

export const MOCK_SHARE_LINK_LIMIT = 100;

/** A link as the mock keeps it: the API's fields and the token it would only keep the hash of. */
export interface MockShareLink extends ShareLinkResponse {
  token: string;
}

const shareLinksByState = new WeakMap<MockAppState, MockShareLink[]>();

/** The share links of a mock app, kept beside its state. */
export function mockShareLinks(state: MockAppState): MockShareLink[] {
  let links = shareLinksByState.get(state);
  if (!links) {
    links = [];
    shareLinksByState.set(state, links);
  }
  return links;
}

const isLive = (link: MockShareLink) => Date.parse(link.expiresAt) > Date.now();
const withoutToken = ({ token: _token, ...link }: MockShareLink): ShareLinkResponse => link;
const viewsLeft = (link: MockShareLink) => link.maxViews === null || link.viewCount < link.maxViews;

/** The writer's entry or book version a link names, as the API checks it; null when it is not theirs. */
function findTarget(state: MockAppState, kind: string, id: number) {
  return kind === "entry"
    ? state.entries.find((entry) => entry.id === id) ?? null
    : state.bookVersions.find((version) => version.id === id) ?? null;
}

function targetNotFound(route: RouteContext["route"], kind: string) {
  return kind === "entry"
    ? fulfillApiError(route, 404, "ENTRY_NOT_FOUND", "Entry not found")
    : fulfillApiError(route, 404, "BOOK_VERSION_NOT_FOUND", "Book version not found");
}

/** `/api/share-links`: the writer's links of one entry or book version, made, listed and revoked as the API does. */
async function handleOwnerRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  const links = mockShareLinks(state);
  if (pathname === "/api/share-links" && request.method() === "GET") {
    const kind = searchParams.get("kind") ?? "";
    const targetId = Number(searchParams.get("targetId"));
    if (!findTarget(state, kind, targetId)) {
      await targetNotFound(route, kind);
      return true;
    }
    const live = links.filter(isLive);
    await fulfillJson(route, {
      links: live.filter((link) => link.kind === kind && link.targetId === targetId).reverse().map(withoutToken),
      limit: MOCK_SHARE_LINK_LIMIT,
      activeCount: live.length,
    });
    return true;
  }

  if (pathname === "/api/share-links" && request.method() === "POST") {
    const draft = request.postDataJSON() as ShareLinkDraft;
    const target = findTarget(state, draft.kind, draft.targetId);
    if (!target) {
      await targetNotFound(route, draft.kind);
      return true;
    }
    if (draft.kind === "entry" && "content" in target && isMockSealed(target)) {
      await fulfillApiError(route, 409, "ENTRY_SEALED", "This entry is sealed as a time capsule until it opens");
      return true;
    }
    const isEntry = draft.kind === "entry";
    const link: MockShareLink = {
      id: Math.max(0, ...links.map((candidate) => candidate.id)) + 1,
      kind: draft.kind,
      targetId: draft.targetId,
      label: draft.label?.trim() || null,
      showMood: isEntry && draft.showMood === true,
      showTags: isEntry && draft.showTags === true,
      maxViews: draft.maxViews ?? null,
      viewCount: 0,
      lastViewedAt: null,
      expiresAt: new Date(draft.expiresAt).toISOString(),
      createdAt: new Date().toISOString(),
      token: randomBytes(32).toString("base64url"),
    };
    links.push(link);
    await fulfillJson(route, { ...withoutToken(link), token: link.token }, { status: 201 });
    return true;
  }

  const revoke = /^\/api\/share-links\/(\d+)$/.exec(pathname);
  if (revoke && request.method() === "DELETE") {
    const index = links.findIndex((link) => link.id === Number(revoke[1]));
    if (index < 0) {
      await fulfillApiError(route, 404, "SHARE_LINK_NOT_FOUND", "This link is not available");
      return true;
    }
    links.splice(index, 1);
    await fulfillJson(route, { success: true });
    return true;
  }
  return false;
}

/** The link a token opens while it still works: unexpired, its entry neither binned nor sealed. */
function findLiveLink(state: MockAppState, token: string) {
  const link = mockShareLinks(state).find((candidate) => candidate.token === token && isLive(candidate));
  if (!link) return null;
  if (link.kind === "bookVersion") {
    const version = state.bookVersions.find((candidate) => candidate.id === link.targetId);
    return version ? { link, version, entry: null } : null;
  }
  const entry = state.entries.find((candidate) => candidate.id === link.targetId);
  return entry && !isMockSealed(entry) ? { link, entry, version: null } : null;
}

const countView = (link: MockShareLink) => {
  link.viewCount += 1;
  link.lastViewedAt = new Date().toISOString();
};

/** `/api/shared/<token>`: what a link shares, for a reader who is not signed in, with one 404 for every refusal. */
async function handleReaderRoutes({ route, pathname, state }: RouteContext): Promise<boolean> {
  const match = /^\/api\/shared\/([^/]+)(\/file|\/attachments\/(\d+)(\/poster)?)?$/.exec(pathname);
  if (!match) return false;
  const [, token = "", rest, attachmentId, poster] = match;
  const live = findLiveLink(state, decodeURIComponent(token));
  const unavailable = () => fulfillApiError(route, 404, "SHARE_LINK_NOT_FOUND", "This link is not available");

  if (!rest) {
    if (!live || !viewsLeft(live.link)) return unavailable().then(() => true);
    if (live.version) {
      const { title, format, filename } = live.version;
      await fulfillJson(route, {
        kind: "bookVersion", expiresAt: live.link.expiresAt, entry: null,
        bookVersion: { title, author: null, format, filename, size: 20 },
      });
      return true;
    }
    const { entry, link } = live;
    countView(link);
    await fulfillJson(route, {
      kind: "entry",
      expiresAt: link.expiresAt,
      bookVersion: null,
      entry: {
        date: entry.date.slice(0, 10),
        timeOfDay: entry.time_of_day ?? null,
        title: entry.title ?? null,
        content: entry.content,
        format: entry.format ?? "plain",
        mood: link.showMood ? entry.mood ?? null : null,
        feelings: link.showMood ? entry.feelings ?? [] : [],
        tags: link.showTags ? entry.tags : [],
        attachments: (entry.attachments ?? []).map((file) => ({
          id: file.id, name: file.original_filename, mimetype: file.mimetype, size: file.size, hasPoster: Boolean(file.poster_filename),
        })),
      },
    });
    return true;
  }

  if (rest === "/file") {
    if (!live?.version || !viewsLeft(live.link)) return unavailable().then(() => true);
    countView(live.link);
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      headers: { "Content-Disposition": `attachment; filename="${live.version.filename}"` },
      body: "%PDF- shared version",
    });
    return true;
  }

  const file = live?.entry?.attachments?.find((candidate) => candidate.id === Number(attachmentId));
  if (!file || (poster && !file.poster_filename)) return unavailable().then(() => true);
  await route.fulfill({ status: 200, contentType: poster ? "image/jpeg" : file.mimetype, body: MOCK_PNG });
  return true;
}

export async function handleShareLinkRoutes(context: RouteContext): Promise<boolean> {
  return (await handleOwnerRoutes(context)) || handleReaderRoutes(context);
}
