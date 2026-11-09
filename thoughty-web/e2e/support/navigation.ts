import type { Page } from '@playwright/test';

/**
 * Each page of the main navigation and the group it sits under, as the app labels them in English
 * and in French (the profile sits apart, beside the log out button).
 */
export const NAV_GROUP_OF_PAGE = {
  Journal: 'Journaling',
  Memoir: 'Journaling',
  Tasks: 'Journaling',
  Tags: 'Journaling',
  Feed: 'Social',
  People: 'Social',
  Stats: 'Insights',
  'Year in review': 'Insights',
  'Manage Diaries': 'Data',
  'Import/Export': 'Data',
  'Recycle bin': 'Data',
} as const;

export const NAV_GROUP_OF_PAGE_FR = {
  Journal: 'Écriture',
  Mémoires: 'Écriture',
  Tâches: 'Écriture',
  Tags: 'Écriture',
  'Fil public': 'Social',
  Personnes: 'Social',
  Statistiques: 'Analyses',
  'Bilan de l’année': 'Analyses',
  'Gérer les journaux': 'Données',
  'Import/Export': 'Données',
  Corbeille: 'Données',
} as const;

export type NavPage = keyof typeof NAV_GROUP_OF_PAGE;
export type NavPageFr = keyof typeof NAV_GROUP_OF_PAGE_FR;

/** The button of a navigation group, by its label. */
export function navGroupButton(page: Page, group: string) {
  return page.getByRole('navigation').getByRole('button', { name: group, exact: true });
}

/** Opens a page from the main navigation: its group first (unless already open), then the page. */
export async function goToView(page: Page, label: NavPage): Promise<void>;
export async function goToView(page: Page, label: NavPageFr, language: 'fr'): Promise<void>;
export async function goToView(page: Page, label: NavPage | NavPageFr, language: 'en' | 'fr' = 'en'): Promise<void> {
  const group = language === 'fr'
    ? NAV_GROUP_OF_PAGE_FR[label as NavPageFr]
    : NAV_GROUP_OF_PAGE[label as NavPage];
  const groupButton = navGroupButton(page, group);
  if (await groupButton.getAttribute('aria-expanded') !== 'true') {
    await groupButton.click();
  }
  await page.getByRole('navigation').getByRole('button', { name: label, exact: true }).click();
}
