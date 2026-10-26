import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import EntryMoodField from './EntryMoodField';
import { moodTranslations } from '../../utils/translations.mood';
import { fillTranslationParams } from '../../utils/translationParams';

const t = (key: string, params?: Record<string, string | number>) =>
  fillTranslationParams(moodTranslations.en[key as keyof typeof moodTranslations.en] ?? key, params);

function StatefulField({ initialMood = null, initialFeelings = [], onChange }: Readonly<{
  initialMood?: number | null;
  initialFeelings?: string[];
  onChange?: (mood: number | null, feelings: string[]) => void;
}>) {
  const [mood, setMood] = useState<number | null>(initialMood);
  const [feelings, setFeelings] = useState<string[]>(initialFeelings);
  return (
    <EntryMoodField
      id="composer-mood"
      mood={mood}
      onMoodChange={(next) => { setMood(next); onChange?.(next, feelings); }}
      feelings={feelings}
      onFeelingsChange={(next) => { setFeelings(next); onChange?.(mood, next); }}
      t={t}
    />
  );
}

describe('EntryMoodField', () => {
  it('offers five labelled levels as radio buttons, none chosen by default', () => {
    render(<StatefulField />);

    const group = screen.getByRole('group', { name: 'Mood (optional)' });
    const radios = screen.getAllByRole('radio');
    expect(group).toContainElement(radios[0] ?? null);
    expect(radios).toHaveLength(5);
    expect(radios.some((radio) => (radio as HTMLInputElement).checked)).toBe(false);
    expect(screen.getByRole('radio', { name: 'Very low' })).toHaveAttribute('id', 'composer-mood-1');
    expect(screen.getByRole('radio', { name: 'Very good' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove the mood' })).not.toBeInTheDocument();
  });

  it('chooses a level and removes it again', async () => {
    const onChange = vi.fn();
    render(<StatefulField onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'Good' }));
    expect(screen.getByRole('radio', { name: 'Good' })).toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(4, []);

    await userEvent.click(screen.getByRole('button', { name: 'Remove the mood' }));
    expect(screen.getByRole('radio', { name: 'Good' })).not.toBeChecked();
    expect(onChange).toHaveBeenLastCalledWith(null, []);
  });

  it('opens the feelings, toggles curated words, and adds the writer’s own on Enter', async () => {
    const onChange = vi.fn();
    render(<StatefulField onChange={onChange} />);

    expect(screen.queryByRole('button', { name: 'calm' })).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Feelings (optional)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);

    const calm = screen.getByRole('button', { name: 'calm' });
    expect(calm).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(calm);
    expect(calm).toHaveAttribute('aria-pressed', 'true');

    const input = screen.getByLabelText('Add a feeling in your own words');
    await userEvent.type(input, 'Nostalgic{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(null, ['calm', 'nostalgic']);
    expect(input).toHaveValue('');

    await userEvent.click(screen.getByRole('button', { name: 'Remove the feeling nostalgic' }));
    expect(onChange).toHaveBeenLastCalledWith(null, ['calm']);
  });

  it('maps a typed curated word to its key and shows the feelings of an edited entry', async () => {
    const onChange = vi.fn();
    render(<StatefulField initialMood={2} initialFeelings={['tired']} onChange={onChange} />);

    expect(screen.getByRole('radio', { name: 'Low' })).toBeChecked();
    expect(screen.getByRole('button', { name: 'tired' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.change(screen.getByLabelText('Add a feeling in your own words'), { target: { value: 'Calme' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onChange).toHaveBeenLastCalledWith(2, ['tired', 'calm']);
    expect(screen.getByRole('button', { name: 'calm' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('stops offering more feelings at the limit', () => {
    const full = Array.from({ length: 10 }, (_, index) => `word ${index}`);
    render(<StatefulField initialFeelings={full} />);

    expect(screen.getByRole('button', { name: 'calm' })).toBeDisabled();
    expect(screen.getByLabelText('Add a feeling in your own words')).toBeDisabled();
    expect(screen.getByText('Up to 10 feelings per entry.')).toBeInTheDocument();
  });
});
