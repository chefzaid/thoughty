import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAiService } from "./aiService";

describe("aiService", () => {
  const mockAuthFetch = vi.fn();
  const service = createAiService(mockAuthFetch);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("findDuplicateEntries returns a valid diary-scoped scan", async () => {
    const scan = {
      analyzedEntries: 2,
      totalEntries: 2,
      truncated: false,
      groups: [{ confidence: 90, reason: "Same conclusion", entries: [] }],
    };
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(scan),
    });

    await expect(service.findDuplicateEntries(4)).resolves.toEqual(scan);
    expect(mockAuthFetch).toHaveBeenCalledWith("/api/ai/duplicates", {
      method: "POST",
      body: JSON.stringify({ diaryId: 4 }),
    });
  });

  it("findDuplicateEntries rejects malformed, failed, and thrown responses", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          analyzedEntries: "two",
          totalEntries: 2,
          truncated: false,
          groups: [],
        }),
    });
    mockAuthFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({}),
    });
    mockAuthFetch.mockRejectedValueOnce(new Error("duplicate scan network"));

    await expect(service.findDuplicateEntries()).resolves.toBeNull();
    await expect(service.findDuplicateEntries()).resolves.toBeNull();
    await expect(service.findDuplicateEntries()).resolves.toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith(
      "Error finding duplicate entries:",
      expect.any(Error),
    );
    consoleSpy.mockRestore();
  });

  it("chat returns assistant reply on success", async () => {
    const messages = [{ role: "user" as const, content: "Hello" }];
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply: "Hi there" }),
    });

    const result = await service.chat(7, "Entry content", messages);

    expect(result).toBe("Hi there");
    expect(mockAuthFetch).toHaveBeenCalledWith("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify({
        entryId: 7,
        entryContent: "Entry content",
        messages,
      }),
    });
  });

  it("semanticSearch returns ranked matches and sends diary scope", async () => {
    const payload = {
      analyzedEntries: 2,
      totalEntries: 5,
      truncated: true,
      matches: [{ entryId: 7, score: 0.91 }],
    };
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    });

    await expect(
      service.semanticSearch("career decisions", 4),
    ).resolves.toEqual(payload);
    expect(mockAuthFetch).toHaveBeenCalledWith("/api/ai/semantic-search", {
      method: "POST",
      body: JSON.stringify({ query: "career decisions", diaryId: 4 }),
    });
  });

  it("semanticSearch rejects malformed match payloads", async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          analyzedEntries: 2,
          totalEntries: 2,
          truncated: false,
          matches: [{ entryId: 7, score: 2 }],
        }),
    });

    await expect(
      service.semanticSearch("career decisions"),
    ).resolves.toBeNull();
  });

  it("chat returns null for malformed reply payload", async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ reply: 10 }),
    });

    const result = await service.chat(7, "Entry content", []);

    expect(result).toBeNull();
  });

  it("getChatHistory returns stored messages on success", async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          messages: [
            { role: "user", content: "Saved prompt" },
            { role: "assistant", content: "Saved reply" },
          ],
        }),
    });

    const result = await service.getChatHistory(12);

    expect(result).toEqual([
      { role: "user", content: "Saved prompt" },
      { role: "assistant", content: "Saved reply" },
    ]);
    expect(mockAuthFetch).toHaveBeenCalledWith("/api/ai/history/12");
  });

  it("getChatHistory returns an empty array for malformed payloads", async () => {
    mockAuthFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ messages: [{ role: "system", content: "Nope" }] }),
    });

    await expect(service.getChatHistory(12)).resolves.toEqual([]);
  });
});
