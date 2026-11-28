import type { MockEntry } from "./mockApp.shared";

// The journal file formats the mock API reads on import and writes on export.

/** The entries of an imported JSON journal (`{ entries }` or a bare list); anything unreadable imports nothing. */
export function parseImportedEntries(
  content: string,
): Array<
  Partial<MockEntry> & { date: string; content: string; tags: string[] }
> {
  try {
    const parsed = JSON.parse(content) as
      | { entries?: Array<Record<string, unknown>> }
      | Array<Record<string, unknown>>;
    const entries = Array.isArray(parsed) ? parsed : parsed.entries || [];

    return entries
      .filter(
        (
          entry,
        ): entry is Record<string, unknown> & {
          date: string;
          content: string;
        } =>
          typeof entry.date === "string" && typeof entry.content === "string",
      )
      .map((entry) => ({
        date: entry.date,
        content: entry.content,
        tags: Array.isArray(entry.tags)
          ? entry.tags.filter((tag): tag is string => typeof tag === "string")
          : [],
        visibility: entry.visibility === "public" ? "public" : "private",
        format: entry.format === "markdown" ? "markdown" : "plain",
      }));
  } catch {
    return [];
  }
}

export function buildExportBody(
  entries: MockEntry[],
  format: string | null,
  includeVisibility = false,
  includeLocation = false,
): { contentType: string; body: string; extension: string } {
  if (format === "zip") {
    return { contentType: "application/zip", extension: "zip", body: "PK mock archive" };
  }

  if (format === "json") {
    return {
      contentType: "application/json",
      extension: "json",
      body: JSON.stringify({
        entries: entries.map((entry) => ({
          date: entry.date,
          index: entry.index,
          tags: entry.tags,
          content: entry.content,
          ...(includeVisibility ? { visibility: entry.visibility } : {}),
          ...(includeLocation && entry.location ? { location: entry.location } : {}),
          format: entry.format || "plain",
        })),
      }),
    };
  }

  return {
    contentType: "text/plain; charset=utf-8",
    extension: "txt",
    body: entries
      .map(
        (entry) =>
          `---${entry.date}--[${entry.tags.join(",")}]\n${entry.content}\n\n--------------------------------------------------------------------------------\n`,
      )
      .join("\n"),
  };
}
