import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getTranslation } from '../../utils/translations';
import PublicEntriesSection from './PublicEntriesSection';

describe('PublicEntriesSection', () => {
  it('offers who may comment on public entries, everyone until chosen', () => {
    const handleChange = vi.fn();
    const t = (key: string) => getTranslation('fr', key);
    render(<PublicEntriesSection defaultCommentPolicy={undefined} handleChange={handleChange} isDark={false} t={t} />);

    expect(screen.getByRole('heading', { name: 'Entrées publiques' })).toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: 'Qui peut commenter' });
    expect(select).toHaveValue('everyone');
    expect(select).toHaveAccessibleDescription(/Chaque entrée suit ce choix/);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Tout le monde',
      'Vos abonnés',
      'Personne (fermés)',
    ]);

    fireEvent.change(select, { target: { value: 'followers' } });
    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ target: expect.objectContaining({ name: 'defaultCommentPolicy' }) }));
  });

  it('shows the saved choice', () => {
    render(<PublicEntriesSection defaultCommentPolicy="closed" handleChange={vi.fn()} isDark t={(key) => key} />);
    expect(screen.getByRole('combobox', { name: 'defaultCommentPolicy' })).toHaveValue('closed');
  });
});
