import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAttachmentsService } from "./attachmentsService";

const captureVideoPoster = vi.fn();

vi.mock("../../utils/videoPoster", () => ({
  captureVideoPoster: (file: Blob) => captureVideoPoster(file),
}));

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
      });
      expect(result).toEqual(mockAttachment);
    });

    it("includes entryId in FormData when provided", async () => {
      authFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 1, mimetype: "image/jpeg" }),
      });

      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      await service.uploadAttachment(file, 42);

      const formData = authFetch.mock.calls[0]![1]?.body as FormData;
      expect(formData.get("entryId")).toBe("42");
    });

    it("gives a video the poster frame drawn from its file, and answers its record with it", async () => {
      const poster = new Blob(["jpeg"], { type: "image/jpeg" });
      captureVideoPoster.mockResolvedValue(poster);
      const stored = { id: 7, mimetype: "video/mp4", stored_filename: "v.mp4" };
      authFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(stored) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ...stored, poster_filename: "p.jpg" }) });
      const file = new File(["video"], "clip.mp4", { type: "video/mp4" });

      await expect(service.uploadAttachment(file, 3)).resolves.toEqual({ ...stored, poster_filename: "p.jpg" });

      expect(captureVideoPoster).toHaveBeenCalledWith(file);
      expect(authFetch).toHaveBeenLastCalledWith("/api/attachments/7/poster", { method: "POST", body: expect.any(FormData) });
      const form = authFetch.mock.calls[1]![1]?.body as FormData;
      expect((form.get("file") as File).name).toBe("poster.jpg");
    });

    it("keeps a video without a poster frame when none can be drawn or stored", async () => {
      const stored = { id: 7, mimetype: "video/webm", stored_filename: "v.webm" };
      const file = new File(["video"], "clip.webm", { type: "video/webm" });
      captureVideoPoster.mockResolvedValueOnce(null);
      authFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(stored) });
      await expect(service.uploadAttachment(file)).resolves.toEqual(stored);
      expect(authFetch).toHaveBeenCalledTimes(1);

      captureVideoPoster.mockResolvedValueOnce(new Blob(["jpeg"]));
      authFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(stored) })
        .mockResolvedValueOnce({ ok: false });
      await expect(service.uploadAttachment(file)).resolves.toEqual(stored);

      captureVideoPoster.mockResolvedValueOnce(new Blob(["jpeg"]));
      authFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(stored) })
        .mockRejectedValueOnce(new Error("offline"));
      await expect(service.uploadAttachment(file)).resolves.toEqual(stored);
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

    it("names the diary a recording without an entry is for", async () => {
      authFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ transcript: "Hi", transcribed_at: "", cached: false }) });

      await service.transcribeAttachment(9, 6);
      await service.transcribeAttachment(9, null);

      expect(authFetch).toHaveBeenNthCalledWith(1, "/api/attachments/9/transcribe", {
        method: "POST",
        body: JSON.stringify({ diaryId: 6 }),
      });
      expect(authFetch).toHaveBeenNthCalledWith(2, "/api/attachments/9/transcribe", { method: "POST" });
    });

    it("returns null when transcription fails", async () => {
      authFetch.mockResolvedValue({ ok: false });

      await expect(service.transcribeAttachment(9)).resolves.toBeNull();
    });
  });

  describe("downloadAttachment", () => {
    it("reads a stored file with the session from Thoughty's own address", async () => {
      const blob = new Blob(["voice"], { type: "audio/webm" });
      authFetch.mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) });

      await expect(service.downloadAttachment("stored-9.webm")).resolves.toBe(blob);
      expect(authFetch).toHaveBeenCalledWith("/api/attachments/file/stored-9.webm");
    });

    it("answers null when the file cannot be read", async () => {
      authFetch.mockResolvedValueOnce({ ok: false }).mockRejectedValueOnce(new Error("offline"));

      await expect(service.downloadAttachment("stored-9.webm")).resolves.toBeNull();
      await expect(service.downloadAttachment("stored-9.webm")).resolves.toBeNull();
    });
  });

  describe("storeTranscript", () => {
    it("sends only the text the writer's own model made", async () => {
      const stored = { transcript: "Dear sister", transcribed_at: "2026-11-24T10:00:00.000Z", cached: false };
      authFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(stored) });

      await expect(service.storeTranscript(9, "Dear sister")).resolves.toEqual({ data: stored, refusal: null });
      expect(authFetch).toHaveBeenCalledWith("/api/attachments/9/transcript", {
        method: "PUT",
        body: JSON.stringify({ transcript: "Dear sister" }),
      });
    });

    it("names the API's refusal, and none when the request fails", async () => {
      authFetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ statusCode: 400, code: "TRANSCRIPT_TOO_LONG", message: "Too long" }), { status: 400 }))
        .mockRejectedValueOnce(new Error("offline"));

      await expect(service.storeTranscript(9, "x")).resolves.toEqual({ data: null, refusal: "apiError_TRANSCRIPT_TOO_LONG" });
      await expect(service.storeTranscript(9, "x")).resolves.toEqual({ data: null, refusal: null });
    });
  });
});
