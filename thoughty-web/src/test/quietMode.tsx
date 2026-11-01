import type { ReactNode } from 'react';
import { QuietModeContext } from '../components/QuietMode/quietMode';

/** A `render` wrapper with quiet mode on, as the signed-in app gives it once the writer saved it. */
export function QuietModeOn({ children }: Readonly<{ children: ReactNode }>) {
  return <QuietModeContext.Provider value>{children}</QuietModeContext.Provider>;
}
