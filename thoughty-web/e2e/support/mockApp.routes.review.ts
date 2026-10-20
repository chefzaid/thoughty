import { buildMockReview } from "./mockApp.review";
import { fulfillJson, type RouteContext } from "./mockApp.route-utils";

export async function handleReviewRoutes({ route, request, pathname, searchParams, state }: RouteContext): Promise<boolean> {
  if (pathname === "/api/review" && request.method() === "GET") {
    const diaryId = searchParams.get("diaryId");
    await fulfillJson(route, buildMockReview(state.entries, Number(searchParams.get("year")), diaryId ? Number(diaryId) : null, state.review));
    return true;
  }

  if (pathname === "/api/review/mood" && request.method() === "POST") {
    const payload = request.postDataJSON() as { year: number; diaryId?: number };
    state.review.moodRequests.push(payload);
    const review = buildMockReview(state.entries, payload.year, payload.diaryId ?? null, state.review);
    const months = review.months
      .filter((month) => month.entries > 0)
      .map((month, index) => ({
        month: `${payload.year}-${String(month.month).padStart(2, "0")}`,
        mood: index % 2 === 0 ? "hopeful" : "restless",
        valence: index % 2 === 0 ? 1 : -1,
      }));
    const mood = { months, summary: "A hopeful year with a restless middle.", analyzedEntries: review.totals.entries, generatedAt: "2026-01-02T10:00:00.000Z" };
    state.review.moods[`${payload.year}:${payload.diaryId ?? "all"}`] = mood;
    await fulfillJson(route, { mood });
    return true;
  }

  return false;
}
