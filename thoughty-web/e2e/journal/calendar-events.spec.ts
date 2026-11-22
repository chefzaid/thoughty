import AxeBuilder from '../support/axe';
import { test, expect, type Page } from '../support/test';
import { setupMockApp } from '../support/mockApp';
import { goToView } from '../support/navigation';
import type { MockCalendarEvent } from '../support/mockApp.routes.calendar-events';

const ICS = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:dinner@example',
  'SUMMARY:Dinner with Lina',
  'LOCATION:Le Petit Zinc',
  'DTSTART:20261122T183000Z',
  'DTEND:20261122T210000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:market@example',
  'SUMMARY:Market',
  'DTSTART;VALUE=DATE:20261122',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:concert@example',
  'SUMMARY:Concert',
  'DTSTART:20261123T190000Z',
  'DTEND:20261123T213000Z',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:yoga@example',
  'SUMMARY:Yoga',
  'DTSTART:20261102T180000Z',
  'RRULE:FREQ=WEEKLY',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:birthday@example',
  'SUMMARY:Lina’s birthday',
  'DTSTART;VALUE=DATE:19901123',
  'RRULE:FREQ=YEARLY',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:stretch@example',
  'SUMMARY:Stretch',
  'DTSTART:20261102T080000Z',
  'RRULE:FREQ=HOURLY;INTERVAL=4',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const TRIP: MockCalendarEvent = {
  id: 1,
  uid: 'trip@example',
  summary: 'Trip to Lyon',
  location: null,
  allDay: true,
  startsAt: null,
  endsAt: null,
  startDate: '2026-11-21',
  endDate: '2026-11-23',
  repeats: false,
};

async function expectNoAxeViolations(page: Page, selector: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .include(selector)
    .analyze();
  expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map((node) => node.target) }))).toEqual([]);
}

test.describe('Imported calendar', () => {
  test.use({ timezoneId: 'Europe/Paris' });

  test.beforeEach(async ({ page }) => {
    // 9:00 in Paris on 22 November 2026, the composer's day
    await page.clock.setFixedTime(new Date('2026-11-22T08:00:00Z'));
  });

  test('imports a calendar file and lists the composer day’s events, repeating ones included, each a question to write about', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true });
    await page.goto('/journal');
    await expect(page.getByRole('textbox', { name: 'Date of the entry' })).toHaveValue('2026-11-22');
    await expect(page.getByRole('region', { name: 'On your calendar' })).toHaveCount(0);

    await goToView(page, 'Import/Export');
    const panel = page.getByRole('region', { name: 'Calendar', exact: true });
    await expect(panel.getByText('No calendar imported yet.')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Remove imported events' })).toHaveCount(0);
    await panel.getByLabel('Choose a calendar file (.ics)').setInputFiles({ name: 'calendar.ics', mimeType: 'text/calendar', buffer: Buffer.from(ICS) });
    await expect(panel.getByText('Repeating events show on each day they fall on.', { exact: false })).toBeVisible();
    await expect(panel.getByRole('status')).toHaveText('Imported 5 events. 1 repeating event could not be read and was left out.');
    await expect(panel.getByText('5 imported events, last imported on November 22, 2026.')).toBeVisible();
    expect(state.calendarEvents.map((event) => event.summary)).toEqual(['Dinner with Lina', 'Market', 'Concert', 'Yoga', 'Lina’s birthday']);
    await expectNoAxeViolations(page, 'section[aria-labelledby="calendar-import-title"]');

    await goToView(page, 'Journal');
    const events = page.getByRole('region', { name: 'On your calendar' });
    await expect(events.getByRole('listitem')).toHaveText([
      /^All day\s*Market\s*Write about it$/,
      /^7:30\s*–\s*10:00\s*PM\s*Dinner with Lina\s*Le Petit Zinc\s*Write about it$/,
    ]);
    await expectNoAxeViolations(page, '.composer-calendar-events');

    const writing = page.getByPlaceholder('What\'s on your mind?');
    await writing.fill('A slow Sunday.');
    await events.getByRole('button', { name: 'Write about “Dinner with Lina”' }).click();
    await expect(writing).toHaveValue('A slow Sunday.\n\nDinner with Lina: how was it?');

    // Another day of the composer shows that day's events
    const date = page.getByRole('textbox', { name: 'Date of the entry' });
    await date.fill('2026-11-23');
    await date.press('Escape');
    // The yearly birthday and the weekly class fall on this Monday, marked as repeating
    await expect(events.getByRole('listitem')).toHaveText([
      /^All day\s*Lina’s birthday\s*Write about it$/,
      /^7:00\s*PM\s*Yoga\s*Write about it$/,
      /^8:00\s*–\s*10:30\s*PM\s*Concert\s*Write about it$/,
    ]);
    await expect(events.getByRole('img', { name: 'Repeats' })).toHaveCount(2);
    await expect(events.getByRole('listitem').nth(1).getByRole('img', { name: 'Repeats' })).toBeVisible();
    await expectNoAxeViolations(page, '.composer-calendar-events');
    await events.getByRole('button', { name: 'Write about “Yoga”' }).click();
    await expect(writing).toHaveValue('A slow Sunday.\n\nDinner with Lina: how was it?\n\nYoga: how was it?');
    // A week later, the class again
    await date.fill('2026-11-30');
    await date.press('Escape');
    await expect(events.getByRole('listitem')).toHaveText([/^7:00\s*PM\s*Yoga\s*Write about it$/]);
    await date.fill('2026-11-24');
    await date.press('Escape');
    await expect(events).toHaveCount(0);
  });

  test('says why a file is refused and removes every imported event once confirmed, in French and the light theme', async ({ page }) => {
    const { state } = await setupMockApp(page, { startAuthenticated: true, calendarEvents: [TRIP], config: { language: 'fr', theme: 'light' } });
    await page.goto('/journal');
    const events = page.getByRole('region', { name: 'Dans votre agenda' });
    await expect(events.getByRole('listitem')).toHaveText([/^Toute la journée\s*Trip to Lyon\s*En parler$/]);
    await expectNoAxeViolations(page, '.composer-calendar-events');

    await goToView(page, 'Import/Export', 'fr');
    const panel = page.getByRole('region', { name: 'Agenda', exact: true });
    await expect(panel.getByText(/^1 événement importé, dernier import le \d+ novembre 2026\.$/)).toBeVisible();
    await panel.getByLabel('Choisir un fichier d’agenda (.ics)').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
    await expect(panel.getByRole('alert')).toHaveText('Ce fichier n’est pas un calendrier. Choisissez un fichier .ics exporté depuis votre application d’agenda.');
    await expectNoAxeViolations(page, 'section[aria-labelledby="calendar-import-title"]');

    await panel.getByRole('button', { name: 'Retirer les événements importés' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Retirer les événements importés ?' });
    await dialog.getByRole('button', { name: 'Retirer les événements importés' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(panel.getByRole('status')).toHaveText('Les événements importés ont été retirés.');
    await expect(panel.getByText('Aucun agenda importé pour l’instant.')).toBeVisible();
    expect(state.calendarEvents).toEqual([]);

    await goToView(page, 'Journal', 'fr');
    await expect(page.getByRole('textbox', { name: 'Date de l’entrée' })).toBeVisible();
    await expect(events).toHaveCount(0);
  });
});
