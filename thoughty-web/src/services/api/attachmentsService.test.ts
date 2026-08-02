import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAttachmentsService } from "./attachmentsService";

describe("createAttachmentsService", () => {
  let authFetch: ReturnType<typeof vi.fn>;
  let service: ReturnType<typeof createAttachmentsService>;

  beforeEach(() => {
    authFetch = vi.fn();
    service = createAttachmentsService(
      authFetch as Parameters<typeof createAttachmentsService>[0],
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("uploadAttachment", () => {
    it("uploads a file successfully", async () => {
      const mockAttachment = {
        id: 1,
        original_filename: "photo.jpg",
        stored_filename: "uuid.jpg",
        mimetype: "image/jpeg",
        size: 1024,
      };
      authFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAttachment),
      });

      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      const result = await service.uploadAttachment(file);

      expect(authFetch).toHaveBeenCalledWith("/api/attachments/upload", {
        method: "POST",
        body: expect.any(FormData),
        headers: {},
      });
      expect(result).toEqual(mockAttachment);
    });

    it("includes entryId in FormData when provided", async () => {
      authFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1 }),
      });

      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      await service.uploadAttachment(file, 42);

      const formData = authFetch.mock.calls[0]![1]?.body as FormData;
      expect(formData.get("entryId")).toBe("42");
    });

    it("returns null on failure", async () => {
      authFetch.mockResolvedValue({ ok: false });

      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      const result = await service.uploadAttachment(file);

      expect(result).toBeNull();
    });

    it("returns null on network error", async () => {
      authFetch.mockRejectedValue(new Error("Network error"));

      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      const result = await service.uploadAttachment(file);

      expect(result).toBeNull();
    });
  });

  describe("linkAttachment", () => {
    it("links an attachment to an entry", async () => {
      authFetch.mockResolvedValue({ ok: true });

      const result = await service.linkAttachment(1, 10);

      expect(authFetch).toHaveBeenCalledWith("/api/attachments/1/link", {
        method: "POST",
        body: JSON.stringify({ entryId: 10 }),
      });
      expect(result).toBe(true);
    });

    it("returns false on failure", async () => {
      authFetch.mockResolvedValue({ ok: false });
      const result = await service.linkAttachment(1, 10);
      expect(result).toBe(false);
    });

    it("returns false on error", async () => {
      authFetch.mockRejectedValue(new Error("fail"));
      const result = await service.linkAttachment(1, 10);
      expect(result).toBe(false);
    });
  });

  describe("deleteAttachment", () => {
    it("deletes an attachment", async () => {
      authFetch.mockResolvedValue({ ok: true });

      const result = await service.deleteAttachment(1);

      expect(authFetch).toHaveBeenCalledWith("/api/attachments/1", {
        method: "DELETE",
      });
      expect(result).toBe(true);
    });

    it("returns false on failure", async () => {
      authFetch.mockResolvedValue({ ok: false });
      const result = await service.deleteAttachment(1);
      expect(result).toBe(false);
    });
  });

  describe("transcribeAttachment", () => {
    it("returns a successful audio transcript", async () => {
      const transcript = {
        transcript: "Voice note",
        transcribed_at: "2026-08-01T12:00:00.000Z",
        cached: false,
      };
      authFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(transcript),
      });

      await expect(service.transcribeAttachment(9)).resolves.toEqual(
        transcript,
      );
      expect(authFetch).toHaveBeenCalledWith("/api/attachments/9/transcribe", {
        method: "POST",
      });
    });

    it("returns null when transcription fails", async () => {
      authFetch.mockResolvedValue({ ok: false });

      await expect(service.transcribeAttachment(9)).resolves.toBeNull();
    });
  });
});
