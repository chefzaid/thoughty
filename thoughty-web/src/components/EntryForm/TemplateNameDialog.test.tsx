import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getTranslation, type Language } from '../../utils/translations';
import TemplateNameDialog from './TemplateNameDialog';

const translate = (language: Language) =>
  (key: string, params?: Record<string, string | number>) => getTranslation(language, key, params);

function renderDialog(overrides: Partial<Parameters<typeof TemplateNameDialog>[0]> = {}) {
  const props = {
    theme: 'dark' as const,
    t: translate('en'),
    onCancel: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };
  render(<TemplateNameDialog {...props} />);
  return props;
}

describe('TemplateNameDialog', () => {
  it('is a modal dialog named by its title with focus in the name field', () => {
    renderDialog();

    const dialog = screen.getByRole('dialog', { name: 'Save as a template' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('The template keeps the text, tags, visibility and format of your draft.');
    expect(screen.getByRole('textbox', { name: 'Template name' })).toHaveFocus();
  });

  it('saves the trimmed name', async () => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();

    await user.type(screen.getByLabelText('Template name'), '  Morning pages  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith('Morning pages');
  });

  it.each(['', '   '])('refuses the name %j with a message tied to the field', async (typed) => {
    const user = userEvent.setup();
    const { onSave } = renderDialog();
    const input = screen.getByLabelText('Template name');
    if (typed) await user.type(input, typed);

    await user.keyboard('{Enter}');

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name for the template.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a name for the template.');
    expect(input).toHaveFocus();

    await user.type(input, 'Evening');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  it('shows that it is saving and ignores a second submit meanwhile', async () => {
    let finish: () => void = () => undefined;
    const onSave = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    renderDialog({ onSave });

    await user.type(screen.getByLabelText('Template name'), 'Weekly{Enter}');
    const saving = screen.getByRole('button', { name: 'Saving...' });
    expect(saving).toBeDisabled();
    await user.type(screen.getByLabelText('Template name'), '{Enter}');
    expect(onSave).toHaveBeenCalledTimes(1);

    finish();
    expect(await screen.findByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it.each([
    ['Cancel', async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole('button', { name: 'Cancel' }))],
    ['Escape', async (user: ReturnType<typeof userEvent.setup>) => user.keyboard('{Escape}')],
    ['the backdrop', async (user: ReturnType<typeof userEvent.setup>) => user.click(document.querySelector<HTMLElement>('.backdrop-blur-sm') as HTMLElement)],
  ])('cancels with %s', async (_label, cancel) => {
    const user = userEvent.setup();
    const { onCancel, onSave } = renderDialog();

    await cancel(user);

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps Tab inside the dialog', async () => {
    const user = userEvent.setup();
    renderDialog();
    const input = screen.getByLabelText('Template name');

    await user.tab();
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    await user.tab();
    expect(input).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  });

  it.each([
    ['light', 'bg-white'],
    ['dark', 'bg-gray-800'],
  ] as const)('uses the %s theme', (theme, className) => {
    renderDialog({ theme });

    expect(screen.getByRole('dialog')).toHaveClass(className);
  });

  it('speaks French', async () => {
    const user = userEvent.setup();
    renderDialog({ t: translate('fr') });

    expect(screen.getByRole('dialog', { name: 'Enregistrer comme modèle' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Saisissez un nom pour le modèle.');
    expect(screen.getByLabelText('Nom du modèle')).toHaveFocus();
  });
});
