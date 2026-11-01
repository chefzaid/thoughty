import { createContext, useContext } from 'react';

/**
 * Quiet mode, from the writer's saved settings: while it is on, the app leaves out streaks, badges,
 * karma, likes, word and entry counts and goal progress, and keeps everything else. Off outside the
 * signed-in app.
 */
export const QuietModeContext = createContext(false);

/** Whether the writer turned quiet mode on. */
export function useQuietMode(): boolean {
  return useContext(QuietModeContext);
}
