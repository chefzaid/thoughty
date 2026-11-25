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

/** The bytes of uploaded videos, recordings and poster frames, served back as they were sent. */
const storedFiles = new Map<string, { body: Buffer; contentType: string }>();

/** The file part of a multipart upload body: its name, type and bytes. */
export function filePart(request: RouteContext["request"]): { name: string; type: string; body: Buffer } | null {
  const body = request.postDataBuffer();
  const boundary = /boundary=(.+)$/.exec(request.headers()["content-type"] ?? "")?.[1];
  if (!body || !boundary) return null;
  const text = body.toString("latin1");
  const header = /name="file"; filename="([^"]*)"\r\nContent-Type: ([^\r]*)\r\n\r\n/.exec(text);
  if (!header) return null;
  const start = header.index + header[0].length;
  const end = text.indexOf(`\r\n--${boundary}`, start);
  return { name: header[1]!, type: header[2]!, body: body.subarray(start, end) };
}

/** An upload on no entry yet, or null; `onEntry` tells a picture already placed from one never uploaded. */
export function findUnplacedAttachment(state: MockAppState, id: number): { attachment: MockAttachment | null; onEntry: boolean } {
  const attachment = poolOf(state).find((candidate) => candidate.id === id) ?? null;
  return { attachment, onEntry: !attachment && Boolean(findAttachment(state, id)) };
}

function findAttachment(state: MockAppState, id: number): MockAttachment | undefined {
  return [...state.entries.flatMap((entry) => entry.attachments ?? []), ...poolOf(state)].find((attachment) => attachment.id === id);
}

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

/** The longest transcript the API keeps (`TRANSCRIPT_MAX_LENGTH`). */
const TRANSCRIPT_MAX_LENGTH = 50_000;

/**
 * `PUT /api/attachments/{id}/transcript`: keeps the transcript the writer's device made of a recording on an entry
 * of a diary set to "My own model only", as the API does, refusing any other.
 */
async function storeLocalTranscript({ route, request, state }: Pick<RouteContext, "route" | "request" | "state">, id: number): Promise<void> {
  const entry = state.entries.find((candidate) => candidate.attachments?.some((attachment) => attachment.id === id));
  const attachment = entry?.attachments?.find((candidate) => candidate.id === id) ?? poolOf(state).find((candidate) => candidate.id === id);
  const text = String((request.postDataJSON() as { transcript?: unknown }).transcript ?? "").trim();
  if (!attachment) {
    await fulfillApiError(route, 404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
  } else if (!attachment.mimetype.startsWith("audio/")) {
    await fulfillApiError(route, 400, "ATTACHMENT_NOT_AUDIO", "Only audio attachments can be transcribed");
  } else if (state.diaries.find((diary) => diary.id === entry?.diaryId)?.aiMode !== "local") {
    await fulfillApiError(route, 403, "TRANSCRIPT_LOCAL_DIARY_ONLY", "Only a recording in a diary on your own model takes a transcript made in the browser");
  } else if (!text) {
    await fulfillApiError(route, 400, "VALIDATION_FAILED", "transcript should not be empty");
  } else if (text.length > TRANSCRIPT_MAX_LENGTH) {
    await fulfillApiError(route, 400, "TRANSCRIPT_TOO_LONG", "The transcript is too long to keep");
  } else {
    attachment.transcript = text;
    attachment.transcribed_at = "2026-11-24T10:00:00.000Z";
    await fulfillJson(route, { transcript: text, transcribed_at: attachment.transcribed_at, cached: false });
  }
}

/**
 * `/api/attachments/*`: uploads, links, deletes, transcripts made on the writer's device, and video poster frames;
 * serves videos, recordings and poster frames as they were sent and every other file as a small PNG.
 */
export async function handleAttachmentRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (!pathname.startsWith("/api/attachments/")) return false;
  const method = request.method();

  if (pathname === "/api/attachments/upload" && method === "POST") {
    const body = request.postDataBuffer()?.toString("latin1") ?? "";
    const file = filePart(request);
    const entryId = Number(/name="entryId"\r\n\r\n([^\r]*)/.exec(body)?.[1]) || null;
    const id = nextAttachmentId++;
    const attachment: MockAttachment = {
      id,
      original_filename: file?.name ?? "file",
      stored_filename: `stored-${id}`,
      mimetype: file?.type ?? "application/octet-stream",
      size: file && /^(video|audio)\//.test(file.type) ? file.body.length : 68,
    };
    if (file && /^(video|audio)\//.test(file.type)) storedFiles.set(attachment.stored_filename, { body: file.body, contentType: file.type });
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

  const poster = /^\/api\/attachments\/(\d+)\/poster$/.exec(pathname);
  if (poster && method === "POST") {
    const attachment = findAttachment(state, Number(poster[1]));
    const file = filePart(request);
    if (!attachment) {
      await fulfillApiError(route, 404, "ATTACHMENT_NOT_FOUND", "Attachment not found");
    } else if (!attachment.mimetype.startsWith("video/")) {
      await fulfillApiError(route, 400, "ATTACHMENT_NOT_VIDEO", "Only video attachments have a poster frame");
    } else if (file?.type !== "image/jpeg" || file.body[0] !== 0xff || file.body[1] !== 0xd8) {
      await fulfillApiError(route, 400, "ATTACHMENT_CONTENT_MISMATCH", "The file content does not match its type");
    } else {
      attachment.poster_filename = `poster-${attachment.id}.jpg`;
      storedFiles.set(attachment.poster_filename, { body: file.body, contentType: "image/jpeg" });
      const entry = state.entries.find((candidate) => candidate.attachments?.includes(attachment));
      await fulfillJson(route, record(attachment, entry ? entry.id : null), { status: 201 });
    }
    return true;
  }

  const transcript = /^\/api\/attachments\/(\d+)\/transcript$/.exec(pathname);
  if (transcript && method === "PUT") {
    await storeLocalTranscript({ route, request, state }, Number(transcript[1]));
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
    const stored = storedFiles.get(pathname.slice("/api/attachments/file/".length));
    await route.fulfill(stored ? { status: 200, ...stored } : { status: 200, contentType: "image/png", body: MOCK_PNG });
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
