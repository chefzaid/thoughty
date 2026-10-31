const SPRINT_STORAGE_KEY = 'thoughty.focusModeSprint';

/** The sprint lengths on offer, in minutes. */
export const SPRINT_MINUTES = [5, 10, 15] as const;

const MINUTE_MS = 60_000;

/** A timed sprint: when it started, on the wall clock, and how many words the draft had then. */
export interface Sprint {
    readonly minutes: number;
    readonly startedAt: number;
    readonly wordsAtStart: number;
}

export type SprintStage = 'running' | 'halfway' | 'ended';

/** One of the offered lengths, or null for no sprint. */
export function parseSprintMinutes(value: string | null | undefined): number | null {
    const minutes = Number(value);
    return SPRINT_MINUTES.some((offered) => offered === minutes) ? minutes : null;
}

/** The sprint length chosen last time, offered again; null when there is none or storage is unavailable. */
export function readSavedSprint(): number | null {
    try {
        return parseSprintMinutes(globalThis.localStorage?.getItem(SPRINT_STORAGE_KEY));
    } catch {
        return null;
    }
}

export function saveSprint(minutes: number | null): void {
    try {
        if (minutes === null) {
            globalThis.localStorage?.removeItem(SPRINT_STORAGE_KEY);
        } else {
            globalThis.localStorage?.setItem(SPRINT_STORAGE_KEY, String(minutes));
        }
    } catch {
        // Remembering the sprint length is a convenience; sprints work without storage.
    }
}

export function startSprint(minutes: number | null, words: number, now = Date.now()): Sprint | null {
    return minutes === null ? null : { minutes, startedAt: now, wordsAtStart: words };
}

export function sprintEndsAt(sprint: Sprint): number {
    return sprint.startedAt + sprint.minutes * MINUTE_MS;
}

function halfwayAt(sprint: Sprint): number {
    return sprint.startedAt + (sprint.minutes * MINUTE_MS) / 2;
}

/** Where the sprint is at `now`, read from the wall clock, so a backgrounded tab still ends on time. */
export function sprintStage(sprint: Sprint, now: number): SprintStage {
    if (now >= sprintEndsAt(sprint)) return 'ended';
    return now >= halfwayAt(sprint) ? 'halfway' : 'running';
}

/** Milliseconds from `now` until the sprint reaches its next stage (halfway, then the end). */
export function msToNextStage(sprint: Sprint, now: number): number {
    const next = now < halfwayAt(sprint) ? halfwayAt(sprint) : sprintEndsAt(sprint);
    return Math.max(0, next - now);
}

/** Time left as mm:ss, counting a started second as a whole one ("10:00", then "09:59"). */
export function formatCountdown(msLeft: number): string {
    const seconds = Math.max(0, Math.ceil(msLeft / 1000));
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}
