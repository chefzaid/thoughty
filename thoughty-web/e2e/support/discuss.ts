import type { Locator } from '@playwright/test';

/**
 * Picks one of an entry card's Discuss choices, "With AI" (the entry's AI chat) or "With someone" (a message to a
 * writer), from the menu the Discuss button opens while both are offered; names in English unless given.
 */
export async function discussEntry(entry: Locator, choice: string, button = 'Discuss this entry'): Promise<void> {
  await entry.getByRole('button', { name: button }).click();
  await entry.getByRole('menuitem', { name: choice }).click();
}
