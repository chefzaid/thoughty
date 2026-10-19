import { sortEntries } from "./mockApp.shared";
import { fulfillJson, type RouteContext } from "./mockApp.route-utils";

interface AppImportPayload {
  source: string;
  diaryId?: number;
  journalsAsDiaries?: boolean;
  entries: Array<{
    sourceId: string;
    date: string;
    content: string;
    tags: string[];
    favorite?: boolean;
    journal?: string;
  }>;
}

/** Splits a multipart body into its entry IDs and the name and type of each file. */
function readMultipart(body: string): { entryIds: number[]; files: Array<{ name: string; type: string }> } {
  const entryIds = /name="entryIds"\r\n\r\n([^\r]*)/.exec(body)?.[1] ?? "";
  const files = [...body.matchAll(/name="files"; filename="([^"]*)"\r\nContent-Type: ([^\r]*)/g)].map((match) => ({
    name: match[1]!,
    type: match[2]!,
  }));
  return { entryIds: entryIds.split(",").map(Number), files };
}

export async function handleAppImportRoutes({ route, request, pathname, state }: RouteContext): Promise<boolean> {
  if (pathname === "/api/io/import/entries" && request.method() === "POST") {
    const payload = request.postDataJSON() as AppImportPayload;
    state.appImport.entryPayloads.push(payload);
    const createdDiaries: string[] = [];
    let importedCount = 0;

    const diaryFor = (journal?: string): number => {
      if (!payload.journalsAsDiaries || !journal) {
        return payload.diaryId ?? 1;
      }
      const existing = state.diaries.find((diary) => diary.name.toLowerCase() === journal.toLowerCase());
      if (existing) {
        return existing.id;
      }
      const id = Math.max(...state.diaries.map((diary) => diary.id)) + 1;
      state.diaries.push({ id, name: journal, icon: "📓", is_default: false, visibility: "private" });
      createdDiaries.push(journal);
      return id;
    };

    const entries = payload.entries.map((item) => {
      const ref = `${payload.source}:${item.sourceId}`;
      const existingId = state.appImport.refs[ref];
      if (existingId) {
        const existing = state.entries.find((entry) => entry.id === existingId);
        return {
          sourceId: item.sourceId,
          entryId: existingId,
          alreadyImported: true,
          attachedFiles: (existing?.attachments ?? []).map((attachment) => attachment.original_filename),
        };
      }
      const id = state.nextEntryId++;
      state.appImport.refs[ref] = id;
      state.entries.push({
        id,
        date: item.date,
        index: state.entries.filter((entry) => entry.date === item.date).length + 1,
        content: item.content,
        tags: item.tags,
        visibility: "private",
        format: "markdown",
        is_favorite: item.favorite === true,
        diaryId: diaryFor(item.journal),
        attachments: [],
      });
      importedCount++;
      return { sourceId: item.sourceId, entryId: id, alreadyImported: false, attachedFiles: [] };
    });
    state.entries = sortEntries(state.entries);

    await fulfillJson(route, {
      entries,
      importedCount,
      alreadyImportedCount: payload.entries.length - importedCount,
      createdDiaries,
    });
    return true;
  }

  if (pathname === "/api/io/import/attachments" && request.method() === "POST") {
    const { entryIds, files } = readMultipart(request.postDataBuffer()?.toString("latin1") ?? "");
    const attachments = files.map((file, index) => {
      const entryId = entryIds[index]!;
      const id = 900 + state.appImport.uploads.length;
      state.appImport.uploads.push({ entryId, ...file });
      state.entries.find((entry) => entry.id === entryId)?.attachments?.push({
        id,
        original_filename: file.name,
        stored_filename: `${id}-${file.name}`,
        mimetype: file.type,
        size: 10,
      });
      return { id, entryId, originalFilename: file.name };
    });

    await fulfillJson(route, { attachments });
    return true;
  }

  return false;
}
