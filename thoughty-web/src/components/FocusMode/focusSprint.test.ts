import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    formatCountdown, msToNextStage, parseSprintMinutes, readSavedSprint, saveSprint, sprintEndsAt, sprintStage, startSprint,
} from './focusSprint';

describe('focus mode sprints', () => {
    afterEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
    });

    it('offers only 5, 10 and 15 minutes', () => {
        expect([parseSprintMinutes('5'), parseSprintMinutes('10'), parseSprintMinutes('15')]).toEqual([5, 10, 15]);
        expect([parseSprintMinutes(''), parseSprintMinutes('7'), parseSprintMinutes(null), parseSprintMinutes(undefined)])
            .toEqual([null, null, null, null]);
    });

    it('remembers the last length, forgets it when turned off, and works without storage', () => {
        saveSprint(10);
        expect(localStorage.getItem('thoughty.focusModeSprint')).toBe('10');
        expect(readSavedSprint()).toBe(10);
        saveSprint(null);
        expect(readSavedSprint()).toBeNull();

        localStorage.setItem('thoughty.focusModeSprint', '25');
        expect(readSavedSprint()).toBeNull();

        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
        expect(readSavedSprint()).toBeNull();
        expect(() => saveSprint(5)).not.toThrow();
    });

    it('follows the wall clock through halfway to the end', () => {
        expect(startSprint(null, 3)).toBeNull();
        const sprint = startSprint(10, 3, 1_000);
        expect(sprint).toEqual({ minutes: 10, startedAt: 1_000, wordsAtStart: 3 });
        if (!sprint) return;

        expect(sprintEndsAt(sprint)).toBe(601_000);
        expect(sprintStage(sprint, 1_000)).toBe('running');
        expect(msToNextStage(sprint, 1_000)).toBe(300_000);
        expect(sprintStage(sprint, 301_000)).toBe('halfway');
        expect(msToNextStage(sprint, 301_000)).toBe(300_000);
        expect(sprintStage(sprint, 601_000)).toBe('ended');
        expect(msToNextStage(sprint, 900_000)).toBe(0);
    });

    it('writes the time left as mm:ss, counting a started second', () => {
        expect(formatCountdown(600_000)).toBe('10:00');
        expect(formatCountdown(599_001)).toBe('10:00');
        expect(formatCountdown(599_000)).toBe('09:59');
        expect(formatCountdown(61_000)).toBe('01:01');
        expect(formatCountdown(1)).toBe('00:01');
        expect(formatCountdown(-5)).toBe('00:00');
    });
});
