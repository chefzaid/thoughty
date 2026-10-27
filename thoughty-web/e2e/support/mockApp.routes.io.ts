import {
  buildExportBody,
  DEFAULT_FORMAT_CONFIG,
  parseImportedEntries,
  sortEntries,
} from "./mockApp.shared";
import { fulfillJson, type RouteContext } from "./mockApp.route-utils";

export async function handleIoRoutes({
  route,
  request,
  url,
  pathname,
  searchParams,
  state,
}: RouteContext): Promise<boolean> {
  if (pathname === "/api/io/format") {
    // The saved settings over the defaults, as the API fills them in
    const formatConfig = () => ({ ...DEFAULT_FORMAT_CONFIG, ...(state.lastFormatPayload as object | null) });
    if (request.method() === "POST") {
      state.lastFormatPayload = request.postDataJSON();
      await fulfillJson(route, { success: true, config: formatConfig() });
      return true;
    }

    await fulfillJson(route, formatConfig());
    return true;
  }

  if (pathname === "/api/io/preview") {
    const payload = request.postDataJSON() as { content: string };
    state.lastPreviewPayload = payload;
    const importedEntries = parseImportedEntries(payload.content);

    await fulfillJson(route, {
      entries: importedEntries.map((entry, index) => ({
        date: entry.date,
        index: entry.index ?? index + 1,
        tags: entry.tags,
        content: entry.content,
        format: entry.format || "plain",
        ...(entry.visibility ? { visibility: entry.visibility } : {}),
      })),
      totalCount: importedEntries.length,
      duplicates: [],
      duplicateCount: 0,
    });
    return true;
  }

  if (pathname === "/api/io/import") {
    const payload = request.postDataJSON() as {
      content: string;
      diaryId?: number | null;
    };
    state.lastImportPayload = payload;
    const importedEntries = parseImportedEntries(payload.content);

    for (const imported of importedEntries) {
      const sameDayEntries = state.entries.filter(
        (entry) => entry.date === imported.date,
      );
      state.entries.push({
        id: state.nextEntryId++,
        date: imported.date,
        index: sameDayEntries.length + 1,
        content: imported.content,
        tags: imported.tags,
        visibility: imported.visibility || "private",
        format: imported.format || "plain",
        diaryId: payload.diaryId ?? 1,
      });
    }

    state.entries = sortEntries(state.entries);

    await fulfillJson(route, {
      success: true,
      importedCount: importedEntries.length,
      skippedCount: 0,
      totalProcessed: importedEntries.length,
    });
    return true;
  }

  if (pathname === "/api/io/export") {
    state.lastExportRequestUrl = url;
    const { body, contentType, extension } = buildExportBody(
      state.entries,
      searchParams.get("format"),
    );

    await route.fulfill({
      status: 200,
      contentType,
      headers: {
        "Content-Disposition": `attachment; filename="thoughty_export_2026-04-18.${extension}"`,
      },
      body,
    });
    return true;
  }

  return false;
}
