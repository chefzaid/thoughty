import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { parseTagMetadata, serializeTagMetadata } from '../../utils/tagMetadata';
import TagManagerPage from './TagManagerPage';

vi.mock('../ProfilePage/TagOrganizationSection', () => ({
  default: ({ setLocalConfig, setRenameDrafts }: {
    setLocalConfig: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
    setRenameDrafts: (value: Record<string, string>) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        setLocalConfig((prev) => ({
          ...prev,
          tagMetadata: serializeTagMetadata({ focus: { color: '#FF0000' } }),
        }));
        setRenameDrafts({ focus: 'focus-updated' });
      }}
    >
      mock-edit
    </button>
  ),
}));

describe('TagManagerPage', () => {
  const baseConfig = {
    name: 'User',
    theme: 'dark' as const,
    tagMetadata: serializeTagMetadata({ focus: { color: '#22C55E' } }),
  };

  it('saves updates after successful rename flow and shows toast', async () => {
    const user = userEvent.setup();
    const onRenameTag = vi.fn().mockResolvedValue(true);
    const onUpdateConfig = vi.fn().mockResolvedValue(undefined);

    render(
      <TagManagerPage
        config={baseConfig}
        allTags={['focus']}
        onUpdateConfig={onUpdateConfig}
        onRenameTag={onRenameTag}
        t={(key: string) => key}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'mock-edit' }));
    await user.click(screen.getByRole('button', { name: 'saveSettings' }));

    await waitFor(() => {
      expect(onRenameTag).toHaveBeenCalledWith('focus', 'focus-updated');
      expect(onUpdateConfig).toHaveBeenCalledTimes(1);
    });

    const savedConfig = onUpdateConfig.mock.calls[0]?.[0] as { tagMetadata?: string };
    expect(parseTagMetadata(savedConfig.tagMetadata)).toEqual({
      'focus-updated': { color: '#FF0000' },
    });

    expect(screen.getByText('settingsSaved')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText('settingsSaved')).not.toBeInTheDocument();
    }, { timeout: 4000 });
  });

  it('stops save flow when a rename fails', async () => {
    const user = userEvent.setup();
    const onRenameTag = vi.fn().mockResolvedValue(false);
    const onUpdateConfig = vi.fn().mockResolvedValue(undefined);

    render(
      <TagManagerPage
        config={baseConfig}
        allTags={['focus']}
        onUpdateConfig={onUpdateConfig}
        onRenameTag={onRenameTag}
        t={(key: string) => key}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'mock-edit' }));
    await user.click(screen.getByRole('button', { name: 'saveSettings' }));

    await waitFor(() => {
      expect(onRenameTag).toHaveBeenCalledWith('focus', 'focus-updated');
    });

    expect(onUpdateConfig).not.toHaveBeenCalled();
    expect(screen.queryByText('settingsSaved')).not.toBeInTheDocument();
  });

  it('saves directly when there are no pending renames', async () => {
    const user = userEvent.setup();
    const onRenameTag = vi.fn().mockResolvedValue(true);
    const onUpdateConfig = vi.fn().mockResolvedValue(undefined);

    render(
      <TagManagerPage
        config={baseConfig}
        allTags={['focus']}
        onUpdateConfig={onUpdateConfig}
        onRenameTag={onRenameTag}
        t={(key: string) => key}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'saveSettings' }));

    await waitFor(() => {
      expect(onUpdateConfig).toHaveBeenCalledTimes(1);
    });

    expect(onRenameTag).not.toHaveBeenCalled();
  });
});
