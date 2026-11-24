import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getTranslation } from '../../utils/translations';
import FollowApprovalSetting from './FollowApprovalSetting';

const fetchFollows = vi.fn();
const setFollowApproval = vi.fn();
const feedService = { fetchFollows, setFollowApproval };

vi.mock('../../hooks/useFeedService', () => ({
  useFeedService: () => feedService,
}));

const user = (id: number, username: string) => ({ id, username, avatarUrl: null, followedAt: '2026-08-01T00:00:00.000Z' });
const follows = (approvalRequired: boolean, requests: ReturnType<typeof user>[] = []) => ({
  data: { following: [], requested: [], topics: [], followers: [], followerCount: 0, requests, approvalRequired },
  error: null,
});

const renderSetting = (language: 'en' | 'fr' = 'en') =>
  render(<FollowApprovalSetting isDark language={language} t={(key, params) => getTranslation(language, key, params)} />);

describe('FollowApprovalSetting', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is off until the writer turns it on, and saves it at once', async () => {
    fetchFollows.mockResolvedValue(follows(false));
    setFollowApproval.mockResolvedValue({ data: { required: true, approved: 0 }, error: null });
    renderSetting();

    const toggle = await screen.findByRole('switch', { name: 'Followers by approval' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(toggle);

    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
    expect(setFollowApproval).toHaveBeenCalledWith(true);
    expect(screen.getByRole('status')).toHaveTextContent('Followers by approval is on.');
  });

  it('asks before turning it off with requests waiting, then says how many were approved', async () => {
    fetchFollows.mockResolvedValue(follows(true, [user(3, 'Pia'), user(4, 'Omar')]));
    setFollowApproval.mockResolvedValue({ data: { required: false, approved: 2 }, error: null });
    renderSetting('fr');

    fireEvent.click(await screen.findByRole('switch', { name: 'Abonnés sur approbation' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Les 2 demandes encore en attente seront approuvées');
    expect(setFollowApproval).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Désactiver et approuver' }));

    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false'));
    expect(setFollowApproval).toHaveBeenCalledWith(false);
    expect(screen.getByRole('status')).toHaveTextContent('2 demandes en attente ont été approuvées');
  });

  it('keeps it on when the confirmation is cancelled, and turns it off at once with no request waiting', async () => {
    fetchFollows.mockResolvedValueOnce(follows(true, [user(3, 'Pia')]));
    const { unmount } = renderSetting();
    fireEvent.click(await screen.findByRole('switch'));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('The 1 request still waiting will be approved');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
    unmount();

    fetchFollows.mockResolvedValue(follows(true));
    setFollowApproval.mockResolvedValue({ data: { required: false, approved: 0 }, error: null });
    renderSetting();
    fireEvent.click(await screen.findByRole('switch'));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Followers by approval is off.'));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('says when it cannot be loaded or saved', async () => {
    fetchFollows.mockResolvedValueOnce({ data: null, error: 'Failed' });
    const { unmount } = renderSetting();
    expect(await screen.findByRole('alert')).toHaveTextContent('Followers by approval could not be loaded.');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    unmount();

    fetchFollows.mockResolvedValue(follows(false));
    setFollowApproval.mockResolvedValue({ data: null, error: 'followApprovalSaveError' });
    renderSetting();
    fireEvent.click(await screen.findByRole('switch'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Followers by approval could not be changed.');
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });
});
