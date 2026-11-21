import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTranslation } from '../../utils/translations';
import { peopleByHandle } from '../../utils/mentions';
import type { Person } from '../../services/api/peopleService';
import { MentionPeopleContext } from '../People/PeopleContext';
import { createFakeContext, drawnText, type FakeContext } from './shareCard.test-utils';
import ShareImageDialog, { type ShareableEntry } from './ShareImageDialog';

const downloadBlob = vi.hoisted(() => vi.fn());
vi.mock('../../utils/downloadFile', () => ({ downloadBlob }));

const t = (key: string, params?: Record<string, string | number>) => getTranslation('en', key, params);
const marie: Person = { id: 1, name: 'Marie Dupont', handles: ['marie'], date: null, entryCount: 1, lastMentionedOn: null, createdAt: '', updatedAt: '' };
const ENTRY: ShareableEntry = { content: 'Tea with @marie by the sea.', format: 'plain', title: 'Marie Dupont visits', date: '2026-10-12', visibility: 'private' };

let ctx: FakeContext;

function renderDialog(checkPeople: boolean) {
  render(
    <MentionPeopleContext.Provider value={{ people: [marie], byHandle: peopleByHandle([marie]) }}>
      <ShareImageDialog isOpen entry={ENTRY} checkPeople={checkPeople} isDark={false} language="en" onClose={vi.fn()} t={t} />
    </MentionPeopleContext.Provider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  ctx = createFakeContext().ctx;
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(new Blob(['png'], { type: 'image/png' })));
});

afterEach(() => {
  vi.restoreAllMocks();
  downloadBlob.mockReset();
});

describe('ShareImageDialog people check', () => {
  it('downloads at once when it checks no one, as for a feed entry', async () => {
    const user = renderDialog(false);
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    expect(downloadBlob).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'People in what you share' })).not.toBeInTheDocument();
  });

  it('lists the people the card names before it leaves, and downloads on Share anyway', async () => {
    const user = renderDialog(true);
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    const check = screen.getByRole('dialog', { name: 'People in what you share' });
    expect(check).toHaveTextContent('Marie Dupont2 mentions');
    expect(downloadBlob).not.toHaveBeenCalled();
    await user.click(within(check).getByRole('button', { name: 'Share anyway' }));
    expect(downloadBlob).toHaveBeenCalledTimes(1);
  });

  it('changes only the card’s text and title on Replace, and downloads nothing', async () => {
    const user = renderDialog(true);
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    const check = screen.getByRole('dialog', { name: 'People in what you share' });
    await user.selectOptions(within(check).getByRole('combobox'), 'a friend');
    ctx.fillText.mockClear();
    await user.click(within(check).getByRole('button', { name: 'Replace' }));

    expect(screen.getByLabelText('Text on the card')).toHaveValue('Tea with a friend by the sea.');
    expect(drawnText(ctx)).toContain('A friend visits');
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it('leaves the title alone when the card does not show it', async () => {
    const user = renderDialog(true);
    await user.click(screen.getByRole('checkbox', { name: /title/i }));
    await user.click(screen.getByRole('button', { name: 'Download PNG' }));

    const check = screen.getByRole('dialog', { name: 'People in what you share' });
    expect(check).toHaveTextContent('Marie Dupont1 mention');
    await user.click(within(check).getByRole('button', { name: 'Replace' }));
    expect(screen.getByLabelText('Text on the card')).toHaveValue('Tea with M. D. by the sea.');
    ctx.fillText.mockClear();
    await user.click(screen.getByRole('checkbox', { name: /title/i }));
    expect(drawnText(ctx)).toContain('Marie Dupont visits');
  });
});
