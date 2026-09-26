import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { parseTagMetadata, serializeTagMetadata } from '../../utils/tagMetadata';
import TagManagerPage from './TagManagerPage';

vi.mock('../ProfilePage/TagOrganizationSection', () => ({
  default: ({ setLocalConfig, setRenameDrafts, onDeleteTag, tagUsage }: {
    setLocalConfig: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
    setRenameDrafts: (value: Record<string, string>) => void;
    onDeleteTag: (tag: string) => void;
    tagUsage: Record<string, number>;
  }) => (
    <>
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
      <button type="button" onClick={() => setRenameDrafts({ draft: 'draft-renamed' })}>
        mock-rename-unused
      </button>
      <button type="button" onClick={() => onDeleteTag('focus')}>mock-delete-focus</button>
      <button type="button" onClick={() => onDeleteTag('draft')}>mock-delete-draft</button>
      <span data-testid="focus-usage">{tagUsage.focus ?? 0}</span>
    </>
  ),
}));

vi.mock('./JournalRetagReview', () => ({
  default: () => <button type="button">organizeJournalTags</button>,
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
        onDeleteTag={vi.fn().mockResolvedValue(true)}
        onLoadTagUsage={vi.fn().mockResolvedValue([])}
        onRetagApplied={vi.fn().mockResolvedValue(undefined)}
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
        onDeleteTag={vi.fn().mockResolvedValue(true)}
        onLoadTagUsage={vi.fn().mockResolvedValue([])}
        onRetagApplied={vi.fn().mockResolvedValue(undefined)}
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
        onDeleteTag={vi.fn().mockResolvedValue(true)}
        onLoadTagUsage={vi.fn().mockResolvedValue([])}
        onRetagApplied={vi.fn().mockResolvedValue(undefined)}
        t={(key: string) => key}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'saveSettings' }));

    await waitFor(() => {
      expect(onUpdateConfig).toHaveBeenCalledTimes(1);
    });

    expect(onRenameTag).not.toHaveBeenCalled();
  });

  describe('tag CRUD', () => {
    const configWithDraft = {
      ...baseConfig,
      tagMetadata: serializeTagMetadata({ focus: { color: '#22C55E' }, draft: { color: '#2563EB' } }),
    };

    const renderPage = (overrides: Partial<Parameters<typeof TagManagerPage>[0]> = {}) => {
      const props = {
        config: configWithDraft,
        allTags: ['focus'],
        onUpdateConfig: vi.fn().mockResolvedValue(undefined),
        onRenameTag: vi.fn().mockResolvedValue(true),
        onDeleteTag: vi.fn().mockResolvedValue(true),
        onLoadTagUsage: vi.fn().mockResolvedValue([{ tag: 'focus', count: 3 }]),
        onRetagApplied: vi.fn().mockResolvedValue(undefined),
        t: (key: string, params?: Record<string, string | number>) =>
          params ? `${key}:${JSON.stringify(params)}` : key,
        ...overrides,
      };
      render(<TagManagerPage {...props} />);
      return props;
    };

    it('loads tag usage counts', async () => {
      renderPage();

      expect(await screen.findByText('3')).toBeInTheDocument();
    });

    it('creates a tag with an assigned color', async () => {
      const user = userEvent.setup();
      const props = renderPage();

      await user.type(screen.getByPlaceholderText('newTagPlaceholder'), '#Gratitude');
      await user.click(screen.getByRole('button', { name: 'addTag' }));

      await waitFor(() => expect(props.onUpdateConfig).toHaveBeenCalledTimes(1));
      const savedConfig = vi.mocked(props.onUpdateConfig).mock.calls[0]?.[0] as { tagMetadata?: string };
      expect(parseTagMetadata(savedConfig.tagMetadata).gratitude?.color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(screen.getByPlaceholderText('newTagPlaceholder')).toHaveValue('');
    });

    it('rejects a tag that already exists', async () => {
      const user = userEvent.setup();
      const props = renderPage();

      await user.type(screen.getByPlaceholderText('newTagPlaceholder'), 'Focus');
      await user.click(screen.getByRole('button', { name: 'addTag' }));

      expect(screen.getByRole('alert')).toHaveTextContent('tagAlreadyExists');
      expect(props.onUpdateConfig).not.toHaveBeenCalled();
    });

    it('deletes a used tag from entries after confirmation and drops its metadata', async () => {
      const user = userEvent.setup();
      const props = renderPage();
      await screen.findByText('3');

      await user.click(screen.getByRole('button', { name: 'mock-delete-focus' }));
      expect(screen.getByText('deleteTagConfirm:{"tag":"focus","count":3}')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'delete' }));

      await waitFor(() => expect(props.onUpdateConfig).toHaveBeenCalledTimes(1));
      expect(props.onDeleteTag).toHaveBeenCalledWith('focus');
      const savedConfig = vi.mocked(props.onUpdateConfig).mock.calls[0]?.[0] as { tagMetadata?: string };
      expect(parseTagMetadata(savedConfig.tagMetadata)).toEqual({ draft: { color: '#2563EB' } });
    });

    it('deletes an unused tag without touching entries', async () => {
      const user = userEvent.setup();
      const props = renderPage();

      await user.click(screen.getByRole('button', { name: 'mock-delete-draft' }));
      await user.click(screen.getByRole('button', { name: 'delete' }));

      await waitFor(() => expect(props.onUpdateConfig).toHaveBeenCalledTimes(1));
      expect(props.onDeleteTag).not.toHaveBeenCalled();
    });

    it('keeps metadata when deleting a tag from entries fails', async () => {
      const user = userEvent.setup();
      const props = renderPage({ onDeleteTag: vi.fn().mockResolvedValue(false) });

      await user.click(screen.getByRole('button', { name: 'mock-delete-focus' }));
      await user.click(screen.getByRole('button', { name: 'delete' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('deleteTagFailed');
      expect(props.onUpdateConfig).not.toHaveBeenCalled();
    });

    it('renames an unused tag without calling the entries API', async () => {
      const user = userEvent.setup();
      const props = renderPage();

      await user.click(screen.getByRole('button', { name: 'mock-rename-unused' }));
      await user.click(screen.getByRole('button', { name: 'saveSettings' }));

      await waitFor(() => expect(props.onUpdateConfig).toHaveBeenCalledTimes(1));
      expect(props.onRenameTag).not.toHaveBeenCalled();
      const savedConfig = vi.mocked(props.onUpdateConfig).mock.calls[0]?.[0] as { tagMetadata?: string };
      expect(parseTagMetadata(savedConfig.tagMetadata)['draft-renamed']).toEqual({ color: '#2563EB' });
    });
  });
});
