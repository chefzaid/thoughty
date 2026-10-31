import { useCallback, useEffect, useRef, useState } from 'react';
import { msToNextStage, readSavedSprint, saveSprint, sprintStage, startSprint, type Sprint, type SprintStage } from './focusSprint';

interface ReachedStage {
    readonly sprint: Sprint;
    readonly stage: SprintStage;
    /** Words the draft had when the sprint ended, so the notice keeps the sprint's count while writing goes on. */
    readonly words: number;
}

/**
 * The focus mode sprint: the remembered length starts a sprint when focus mode opens, choosing a
 * length starts a new one, and the stage (halfway, ended) follows the wall clock. Timers only wake
 * it at the halfway point and the end, and it looks at the clock again when the tab is shown, so a
 * sprint keeps running in a backgrounded tab and ends on time.
 */
export function useFocusSprint(words: number) {
    const wordsRef = useRef(words);
    const [minutes, setMinutes] = useState(readSavedSprint);
    const [sprint, setSprint] = useState(() => startSprint(minutes, words));
    const [reached, setReached] = useState<ReachedStage | null>(null);

    useEffect(() => {
        wordsRef.current = words;
    }, [words]);

    useEffect(() => {
        if (!sprint) return undefined;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const check = () => {
            clearTimeout(timeout);
            const now = Date.now();
            const stage = sprintStage(sprint, now);
            setReached((previous) => (previous?.sprint === sprint && previous.stage === stage
                ? previous
                : { sprint, stage, words: wordsRef.current }));
            if (stage !== 'ended') timeout = setTimeout(check, msToNextStage(sprint, now));
        };
        timeout = setTimeout(check, msToNextStage(sprint, Date.now()));
        document.addEventListener('visibilitychange', check);
        return () => {
            clearTimeout(timeout);
            document.removeEventListener('visibilitychange', check);
        };
    }, [sprint]);

    /** Starts a sprint of this length (or none), and offers the same length next time. */
    const choose = useCallback((chosen: number | null) => {
        setMinutes(chosen);
        saveSprint(chosen);
        setSprint(startSprint(chosen, wordsRef.current));
    }, []);

    /** Dismisses the end of a sprint and writes on without one; the remembered length stays. */
    const keepGoing = useCallback(() => {
        setMinutes(null);
        setSprint(null);
    }, []);

    const current = sprint && reached?.sprint === sprint ? reached : null;
    return {
        minutes,
        sprint,
        stage: sprint ? current?.stage ?? 'running' : null,
        wordsInSprint: sprint && current?.stage === 'ended' ? Math.max(0, current.words - sprint.wordsAtStart) : 0,
        choose,
        keepGoing,
    };
}
