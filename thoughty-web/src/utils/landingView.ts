import type { Config, ViewType } from '../types';

/**
 * Where a signed-in writer lands: the simple memoir screen in simple memoir mode, the welcome page while
 * a new account has not answered what it is here for, and the journal otherwise. Only an explicit
 * `false` from the API opens the welcome page, so settings that could not be read never show it.
 */
export function landingViewFor(config: Pick<Config, 'memoirSimpleMode' | 'onboardingDone'>): ViewType {
  if (config.memoirSimpleMode === true) return 'memoirSimple';
  return config.onboardingDone === false ? 'welcome' : 'journal';
}
