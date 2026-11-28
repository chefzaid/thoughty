import { UNSAFE_createMemoryHistory } from 'react-router-dom';

export type MemoryHistory = ReturnType<typeof UNSAFE_createMemoryHistory>;

/**
 * A history at `from` on which another navigation, back to `from`, lands right after the first
 * redirect to `to`, in the same task: as a sign-out's late `navigate('/')` can land just after the
 * landing page asked for `/fr/`, before React has shown `/fr/`.
 */
export function historyWithLateNavigation(from: string, to: string): MemoryHistory {
  const history = UNSAFE_createMemoryHistory({ initialEntries: [from], v5Compat: true });
  const replace = history.replace.bind(history);
  let late = true;
  history.replace = (target, state) => {
    replace(target, state);
    const path = typeof target === 'string' ? target : target.pathname;
    if (late && path === to) {
      late = false;
      replace(from);
    }
  };
  return history;
}
