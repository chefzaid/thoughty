import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { getTranslation } from '../../utils/translations';
import FontSettings from './FontSettings';

const english = (key: string) => getTranslation('en', key);
const french = (key: string) => getTranslation('fr', key);

function renderSettings(overrides: Partial<Parameters<typeof FontSettings>[0]> = {}) {
  // The values as each change reports them, before the controlled select goes back to its prop
  const handleChange = vi.fn((event: { target: { name: string; value: string } }) => [event.target.name, event.target.value]);
  render(
    <FontSettings
      handleChange={handleChange}
      isDark
      selectedFontColor="#123456"
      selectedFontFamily="system"
      selectedFontSize={16}
      selectedLineSpacing="normal"
      selectedLetterSpacing="normal"
      t={english}
      {...overrides}
    />,
  );
  return handleChange;
}

describe('FontSettings', () => {
  it('offers the easy-to-read font beside the others', () => {
    renderSettings({ selectedFontFamily: 'legible' });

    expect(screen.getByRole('combobox', { name: 'Font style' })).toHaveDisplayValue('Easy to read (Atkinson Hyperlegible)');
    expect(screen.getByTestId('font-preview').style.fontFamily).toContain('Atkinson Hyperlegible');
  });

  it('offers the spacing steps as labelled, described choices', () => {
    renderSettings();

    const lineSpacing = screen.getByRole('combobox', { name: 'Line spacing' });
    expect(lineSpacing).toHaveAccessibleDescription('Room between the lines of your entries');
    expect([...lineSpacing.querySelectorAll('option')].map((option) => option.textContent)).toEqual(['Normal', 'Relaxed', 'Loose']);
    const letterSpacing = screen.getByRole('combobox', { name: 'Letter spacing' });
    expect(letterSpacing).toHaveAccessibleDescription('Room between the letters of your entries');
    expect([...letterSpacing.querySelectorAll('option')].map((option) => option.textContent)).toEqual(['Normal', 'Wide', 'Wider']);
  });

  it('saves the step picked under its setting name', () => {
    const handleChange = renderSettings();

    fireEvent.change(screen.getByRole('combobox', { name: 'Line spacing' }), { target: { value: 'loose' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Letter spacing' }), { target: { value: 'wide' } });

    expect(handleChange.mock.results.map((result) => result.value)).toEqual([['lineSpacing', 'loose'], ['letterSpacing', 'wide']]);
  });

  it('previews the chosen spacing on the sample text, and none for normal', () => {
    renderSettings({ selectedLineSpacing: 'relaxed', selectedLetterSpacing: 'wider' });
    expect(screen.getByTestId('font-preview-sample')).toHaveStyle({ lineHeight: '1.9', letterSpacing: '0.12em' });
  });

  it('keeps the sample’s own spacing for normal', () => {
    renderSettings();
    expect(screen.getByTestId('font-preview-sample').style.lineHeight).toBe('');
    expect(screen.getByTestId('font-preview-sample').style.letterSpacing).toBe('');
  });

  it('speaks French', () => {
    renderSettings({ t: french, selectedLineSpacing: 'loose', selectedLetterSpacing: 'wider' });

    expect(screen.getByRole('combobox', { name: 'Interligne' })).toHaveDisplayValue('Très aéré');
    expect(screen.getByRole('combobox', { name: 'Espacement des lettres' })).toHaveDisplayValue('Très large');
    expect(screen.getByRole('option', { name: 'Facile à lire (Atkinson Hyperlegible)' })).toBeInTheDocument();
  });
});
