import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAiService } from "./aiService";

describe("aiService", () => {
  const mockAuthFetch = vi.fn();
  const service = createAiService(mockAuthFetch);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchModels returns models only when response is ok and array-shaped", async () => {
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([{ id: "m1", name: "Model 1" }]),
    });
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: "m1", name: "Model 1" }),
    });
    mockAuthFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve([]),
    });

    await expect(service.fetchModels()).resolves.toEqual([
      { id: "m1", name: "Model 1" },
    ]);
    await expect(service.fetchModels()).resolves.toEqual([]);
    await expect(service.fetchModels()).resolves.toEqual([]);
  });

  it("manages personal credentials and reads their usage dashboard", async () => {
    const status = {
      hasPersonalKey: true,
      keyHint: "...value",
      source: "personal",
      aiAvailable: true,
    } as const;
    const dashboard = {
      provider: {
        label: "Thoughty",
        usage: 2,
        usageDaily: 0.1,
        usageWeekly: 0.5,
        usageMonthly: 1,
        limit: 10,
        limitRemaining: 8,
        limitReset: "monthly",
        expiresAt: null,
      },
      thoughty: {
        promptTokens: 100,
        completionTokens: 50,
        reasoningTokens: 5,
        totalTokens: 150,
        cost: 0.02,
        requests: 2,
        periodDays: 30,
      },
    } as const;
    mockAuthFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(status) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(status) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(status) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(dashboard),
      });

    await expect(service.getCredentialStatus()).resolves.toEqual(status);
    await expect(
      service.updateCredential("sk-or-v1-example-key-value"),
    ).resolves.toEqual({ data: status, error: null });
    await expect(service.removeCredential()).resolves.toEqual({
      data: status,
      error: null,
    });
    await expect(service.getUsageDashboard()).resolves.toEqual({
      data: dashboard,
      error: null,
    });

    expect(mockAuthFetch).toHaveBeenNthCalledWith(2, "/api/ai/credentials", {
      method: "PUT",
      body: JSON.stringify({ apiKey: "sk-or-v1-example-key-value" }),
    });
    expect(mockAuthFetch).toHaveBeenNthCalledWith(3, "/api/ai/credentials", {
      method: "DELETE",
    });
    expect(mockAuthFetch).toHaveBeenNthCalledWith(4, "/api/ai/usage");
  });

  it("previews and applies a journal retag plan", async () => {
    const plan = {
      analyzedEntries: 1,
      totalEntries: 1,
      truncated: false,
      themes: ["growth"],
      entries: [
        {
          id: 1,
          date: "2026-01-01",
          index: 1,
          currentTags: ["old"],
          suggestedTags: ["growth"],
        },
      ],
    };
    mockAuthFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(plan) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, affectedEntries: 1 }),
      });

    await expect(service.previewJournalRetag()).resolves.toEqual({
      data: plan,
      error: null,
    });
    await expect(
      service.applyJournalRetag("replace", [{ entryId: 1, tags: ["growth"] }]),
    ).resolves.toEqual({
      data: { success: true, affectedEntries: 1 },
      error: null,
    });
    expect(mockAuthFetch).toHaveBeenNthCalledWith(
      1,
      "/api/ai/journal-retag/preview",
      {
        method: "POST",
      },
    );
    expect(mockAuthFetch).toHaveBeenNthCalledWith(
      2,
      "/api/ai/journal-retag/apply",
      {
        method: "POST",
        body: JSON.stringify({
          mode: "replace",
          assignments: [{ entryId: 1, tags: ["growth"] }],
        }),
      },
    );
  });

  it("rejects malformed journal retag responses", async () => {
    mockAuthFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ themes: "growth", entries: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: "yes", affectedEntries: 1 }),
      });

    await expect(service.previewJournalRetag()).resolves.toEqual({
      data: null,
      error: "journalRetagError",
    });
    await expect(service.applyJournalRetag("replace", [])).resolves.toEqual({
      data: null,
      error: "journalRetagApplyError",
    });
  });
});
