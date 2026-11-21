import { describe, expect, it } from 'vitest';

import { landingViewFor } from './landingView';

describe('landingViewFor', () => {
  it('opens the welcome page for a new account that has not answered it', () => {
    expect(landingViewFor({ onboardingDone: false })).toBe('welcome');
  });

  it('opens the journal once the welcome page is done, or when the setting could not be read', () => {
    expect(landingViewFor({ onboardingDone: true })).toBe('journal');
    expect(landingViewFor({})).toBe('journal');
  });

  it('keeps simple memoir mode first, whatever the welcome page', () => {
    expect(landingViewFor({ memoirSimpleMode: true, onboardingDone: false })).toBe('memoirSimple');
  });
});
