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
    if (request.method() === "POST") {
      state.lastFormatPayload = request.postDataJSON();
    }

    await fulfillJson(route, state.lastFormatPayload || DEFAULT_FORMAT_CONFIG);
    return true;
  }

  if (pathname === "/api/io/preview") {
    const payload = request.postDataJSON() as { content: string };
    state.lastPreviewPayload = payload;
    const importedEntries = parseImportedEntries(payload.content);

    await fulfillJson(route, {
      totalCount: importedEntries.length,
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

export async function handleBookRoutes({
  route,
  request,
  url,
  pathname,
  state,
}: RouteContext): Promise<boolean> {
  if (pathname === "/api/books/versions" && request.method() === "GET") {
    await fulfillJson(route, state.bookVersions);
    return true;
  }

  if (pathname === "/api/books/versions" && request.method() === "POST") {
    state.lastBookVersionRequestUrl = url;
    const versionNumber = state.bookVersions.length + 1;
    const format = (url.searchParams.get("format") || "pdf") as
      "pdf" | "epub" | "html" | "md";
    const title = url.searchParams.get("title") || "Personal";
    const version = {
      id: 100 + versionNumber,
      versionNumber,
      title,
      format,
      filename: `thoughty_book_${title}_2026-08-01_v${versionNumber}.${format}`,
      chapterCount: 2,
      entryCount: 3,
      addedEntryCount: versionNumber === 1 ? 3 : 1,
      addedChapterTitles: versionNumber === 1 ? ["ideas", "work"] : ["work"],
      createdAt: "2026-08-01T12:00:00.000Z",
    };
    state.bookVersions.unshift(version);
    await fulfillJson(route, version, { status: 201 });
    return true;
  }

  const versionDownload = pathname.match(
    /^\/api\/books\/versions\/(\d+)\/download$/,
  );
  if (versionDownload && request.method() === "GET") {
    state.lastBookVersionDownloadId = Number(versionDownload[1]);
    await route.fulfill({
      status: 200,
      contentType: "application/pdf",
      headers: {
        "Content-Disposition": 'attachment; filename="saved-book-v1.pdf"',
      },
      body: "%PDF- saved version",
    });
    return true;
  }

  if (pathname === "/api/books/upload" && request.method() === "POST") {
    state.lastBookUploadRequestUrl = url;
    state.lastBookUploadRequestBody = request.postData();
    await fulfillJson(
      route,
      {
        id: "cloud-book-1",
        name: `thoughty_book_${url.searchParams.get("title") || "book"}.${url.searchParams.get("format") || "pdf"}`,
        size: 4096,
        modifiedAt: "2026-07-23T12:00:00.000Z",
      },
      { status: 201 },
    );
    return true;
  }

  return false;
}
