import { test, expect } from "@playwright/test";
import { setupMockApp } from "../support/mockApp";

test.describe("Audio note transcription", () => {
  test("transcribes a saved audio attachment inline", async ({ page }) => {
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 21,
          date: "2026-08-01",
          index: 1,
          content: "Voice reflection",
          tags: ["audio"],
          visibility: "private",
          diaryId: 1,
          attachments: [
            {
              id: 9,
              original_filename: "morning-note.mp3",
              stored_filename: "stored-morning-note.mp3",
              mimetype: "audio/mpeg",
              size: 8192,
            },
          ],
        },
      ],
    });

    let transcriptionRequests = 0;
    await page.route("**/api/attachments/**", async (route) => {
      const request = route.request();
      if (
        request.url().endsWith("/transcribe") &&
        request.method() === "POST"
      ) {
        transcriptionRequests += 1;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            transcript: "I want to protect some quiet time for focused work.",
            transcribed_at: "2026-08-01T12:00:00.000Z",
            cached: false,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        body: "mock audio",
      });
    });

    await page.goto("/journal");

    await expect(
      page.getByLabel("morning-note.mp3", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Transcribe audio" }).click();
    await expect(
      page.getByText("I want to protect some quiet time for focused work."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Copy transcript" }),
    ).toBeVisible();
    expect(transcriptionRequests).toBe(1);
  });

  test("keeps a stored transcript readable on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupMockApp(page, {
      startAuthenticated: true,
      initialEntries: [
        {
          id: 22,
          date: "2026-08-01",
          index: 1,
          content: "Mobile voice reflection",
          tags: ["audio"],
          visibility: "private",
          diaryId: 1,
          attachments: [
            {
              id: 10,
              original_filename: "mobile-note.mp3",
              stored_filename: "stored-mobile-note.mp3",
              mimetype: "audio/mpeg",
              size: 8192,
              transcript:
                "A deliberately long transcript line that should wrap cleanly inside the entry without widening the mobile journal viewport.",
              transcribed_at: "2026-08-01T12:00:00.000Z",
            },
          ],
        },
      ],
    });
    await page.route("**/api/attachments/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "audio/mpeg",
        body: "mock audio",
      }),
    );

    await page.goto("/journal");

    const transcript = page.getByText(/A deliberately long transcript line/);
    await expect(transcript).toBeVisible();
    expect(
      await transcript.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(true);
  });
});
