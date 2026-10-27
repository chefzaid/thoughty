import { fulfillApiError, fulfillJson, type RouteContext } from "./mockApp.route-utils";
import type { MockAppState, MockEntry } from "./mockApp.shared";

type MockAttachment = NonNullable<MockEntry["attachments"]>[number];

/** A 1x1 PNG, served for every stored picture. */
export const MOCK_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

/** Uploads not on any entry yet, per mock app. */
const unplaced = new WeakMap<MockAppState, MockAttachment[]>();
const poolOf = (state: MockAppState) => {
  const pool = unplaced.get(state) ?? [];
  unplaced.set(state, pool);
  return pool;
};
let nextAttachmentId = 500;

const INLINE_IMAGE = /!\[((?:\\.|[^\\\]\n])*)\]\(attachment:([^\s)]+)\)/g;

/**
 * Keeps an entry's inline images as the API does (`EntryInlineImagesService`): a reference to the
 * entry's own attachment or to an upload not on any entry (which then joins it) stays, any other
 * becomes its alt text. `previous` is the text before an edit, whose references stay.
 */
export function placeInlineImages(state: MockAppState, entry: MockEntry, previous = ""): void {
  if (entry.format !== "markdown") return;
  const pool = poolOf(state);
  const earlier = new Set([...previous.matchAll(INLINE_IMAGE)].map((match) => match[2]));
  entry.content = entry.content.replaceAll(INLINE_IMAGE, (raw: string, alt: string, target: string) => {
    const id = Number(target);
    if ((entry.attachments ?? []).some((attachment) => attachment.id === id) || earlier.has(target)) return raw;
    const index = pool.findIndex((attachment) => attachment.id === id);
    if (index < 0) return alt;
    entry.attachments = [...(entry.attachments ?? []), ...pool.splice(index, 1)];
    return raw;
  });
}

function record(attachment: MockAttachment, entryId: number | null) {
  return { ...attachment, entry_id: entryId, created_at: "2026-08-01T12:00:00.000Z" };
}

/** `/api/attachments/*`: uploads, links, deletes, and serves every picture as a small PNG. */
export async function handleAttachmentRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (!pathname.startsWith("/api/attachments/")) return false;
  const method = request.method();

  if (pathname === "/api/attachments/upload" && method === "POST") {
    const body = request.postDataBuffer()?.toString("latin1") ?? "";
    const file = /name="file"; filename="([^"]*)"\r\nContent-Type: ([^\r]*)/.exec(body);
    const entryId = Number(/name="entryId"\r\n\r\n([^\r]*)/.exec(body)?.[1]) || null;
    const id = nextAttachmentId++;
    const attachment: MockAttachment = {
      id,
      original_filename: file?.[1] ?? "file",
      stored_filename: `stored-${id}`,
      mimetype: file?.[2] ?? "application/octet-stream",
      size: 68,
    };
    const entry = entryId === null ? undefined : state.entries.find((candidate) => candidate.id === entryId);
    if (entry) entry.attachments = [...(entry.attachments ?? []), attachment];
    else poolOf(state).push(attachment);
    await fulfillJson(route, record(attachment, entry ? entry.id : null), { status: 201 });
    return true;
  }

  const link = /^\/api\/attachments\/(\d+)\/link$/.exec(pathname);
  if (link && method === "POST") {
    const { entryId } = request.postDataJSON() as { entryId: number };
    const pool = poolOf(state);
    const index = pool.findIndex((attachment) => attachment.id === Number(link[1]));
    const entry = state.entries.find((candidate) => candidate.id === entryId);
    const linked = entry?.attachments?.find((attachment) => attachment.id === Number(link[1]));
    if (!entry || (!linked && index < 0)) {
      await fulfillApiError(route, 404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
      return true;
    }
    const attachment = linked ?? pool.splice(index, 1)[0]!;
    if (!linked) entry.attachments = [...(entry.attachments ?? []), attachment];
    await fulfillJson(route, record(attachment, entryId));
    return true;
  }

  const removal = /^\/api\/attachments\/(\d+)$/.exec(pathname);
  if (removal && method === "DELETE") {
    const id = Number(removal[1]);
    for (const entry of state.entries) {
      entry.attachments = entry.attachments?.filter((attachment) => attachment.id !== id);
    }
    await fulfillJson(route, { success: true });
    return true;
  }

  if (pathname.startsWith("/api/attachments/file/") && method === "GET") {
    await route.fulfill({ status: 200, contentType: "image/png", body: MOCK_PNG });
    return true;
  }
  return false;
}

/**
 * A Markdown entry's text for a mock book: with `embed`, its own pictures as data URIs where the text
 * places them, as `layoutBookEntry` does; every other inline image as its alt text.
 */
export function bookInlineImages(entry: MockEntry, embed: boolean): string {
  if (entry.format !== "markdown") return entry.content;
  return entry.content.replaceAll(INLINE_IMAGE, (_raw: string, alt: string, target: string) => {
    const picture = embed && entry.attachments?.find((attachment) => attachment.id === Number(target) && attachment.mimetype.startsWith("image/"));
    return picture ? `![${alt}](data:${picture.mimetype};base64,${MOCK_PNG.toString("base64")})` : alt;
  });
}

/** A file brings no attachments: an imported Markdown entry's inline images keep their alt text. */
export function importedInlineImages(content: string, format?: string): string {
  return format === "markdown" ? content.replaceAll(INLINE_IMAGE, (_raw: string, alt: string) => alt) : content;
}
