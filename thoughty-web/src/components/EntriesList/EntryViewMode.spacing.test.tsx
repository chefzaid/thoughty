import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EntryViewMode from './EntryViewMode';
import { createEntryViewModeProps } from './EntriesList.test-utils';
import type { Config } from '../../types';

const entryText = (config: Config) => {
    render(<EntryViewMode {...createEntryViewModeProps({ config })} />);
    return screen.getByText('First entry').closest<HTMLElement>('.privacy-text')!;
};

describe('EntryViewMode reading comfort', () => {
    it('reads the entry with the writer’s line and letter spacing', () => {
        const text = entryText({ theme: 'dark', lineSpacing: 'loose', letterSpacing: 'wider' });

        expect(text.style.lineHeight).toBe('2.2');
        expect(text.style.letterSpacing).toBe('0.12em');
    });

    it('keeps the journal’s own leading when spacing is normal', () => {
        const text = entryText({ theme: 'dark', lineSpacing: 'normal', letterSpacing: 'normal' });

        expect(text.style.lineHeight).toBe('');
        expect(text.style.letterSpacing).toBe('');
    });
});
