import { buildMockReview, mockReflectionWeek } from "./mockApp.review";
import { fulfillApiError, fulfillJson, type RouteContext } from "./mockApp.route-utils";

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

  if (pathname === "/api/review/week" && request.method() === "GET") {
    const diaryId = searchParams.get("diaryId");
    const week = mockReflectionWeek(state.entries, searchParams.get("today") ?? "", diaryId ? Number(diaryId) : null);
    const saved = state.review.reflections[diaryId ?? "all"];
    const reflection = saved && saved.weekEnd >= week.weekStart && saved.weekEnd <= week.weekEnd ? saved : null;
    await fulfillJson(route, { ...week, reflection, aiAvailable: state.review.aiAvailable });
    return true;
  }

  if (pathname === "/api/review/week" && request.method() === "POST") {
    const payload = request.postDataJSON() as { today: string; diaryId?: number };
    state.review.reflectionRequests.push(payload);
    const week = mockReflectionWeek(state.entries, payload.today, payload.diaryId ?? null);
    if (week.entries === 0) {
      await fulfillApiError(route, 400, "REVIEW_WEEK_EMPTY", "There are no entries to read in the past seven days");
      return true;
    }
    if (state.review.reflectionUnavailable) {
      await fulfillApiError(route, 503, "REVIEW_REFLECTION_UNAVAILABLE", "The week could not be reflected on right now");
      return true;
    }
    const reflection = {
      weekStart: week.weekStart,
      weekEnd: week.weekEnd,
      themes: ["garden", "slow mornings"],
      summary: "You found calm in the garden between long days.",
      question: "What would make one evening this week feel like your own?",
      analyzedEntries: Math.min(week.entries, 21),
      generatedAt: `${payload.today}T18:00:00.000Z`,
    };
    state.review.reflections[String(payload.diaryId ?? "all")] = reflection;
    await fulfillJson(route, { reflection });
    return true;
  }

  return false;
}
