import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTranslation, type Language } from '../../utils/translations';
import PromptCardsMenu from './PromptCardsMenu';

function Composer({ language = 'en', initial = '', onSave = vi.fn(), onSelect = vi.fn() }: {
    language?: Language;
    initial?: string;
    onSave?: (drawn: string) => void;
    onSelect?: (question: string) => void;
}) {
    const [drawn, setDrawn] = useState(initial);
    return (
        <PromptCardsMenu
            language={language}
            drawn={drawn}
            onDrawnChange={(next) => {
                setDrawn(next);
                onSave(next);
            }}
            onSelect={onSelect}
            theme="light"
            t={(key, params) => getTranslation(language, key, params)}
        />
    );
}

describe('PromptCardsMenu', () => {
    beforeEach(() => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('draws a card from every theme, saves it as drawn, and writes about it from the keyboard', async () => {
        const onSave = vi.fn();
        const onSelect = vi.fn();
        const user = userEvent.setup();
        render(<Composer onSave={onSave} onSelect={onSelect} />);

        const drawButton = screen.getByRole('button', { name: 'Draw a card' });
        expect(drawButton).toHaveAttribute('title', 'A hand-written question from the prompt card deck, no AI needed');
        drawButton.focus();
        await user.keyboard('{Enter}');

        const dialog = screen.getByRole('dialog', { name: 'Prompt cards' });
        expect(dialog).toBeInTheDocument();
        expect(screen.getByRole('figure', { name: 'Gratitude card' })).toHaveTextContent('Who made today a little easier, even if they never knew it?');
        expect(screen.getByText('59 cards left before the deck is shuffled')).toBeInTheDocument();
        expect(onSave).toHaveBeenLastCalledWith('gratitude-1');
        expect(screen.getByRole('button', { name: 'Write about this' })).toHaveFocus();

        await user.keyboard('{Enter}');
        expect(onSelect).toHaveBeenCalledWith('Who made today a little easier, even if they never knew it?');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(drawButton).toHaveFocus();

        await user.click(drawButton);
        expect(screen.getByRole('figure', { name: 'Gratitude card' })).toHaveTextContent('What do you own that you would quietly miss');
        expect(onSave).toHaveBeenLastCalledWith('gratitude-1,gratitude-2');
    });

    it('draws from the theme picked, draws another, and closes on Escape with focus back on its button', async () => {
        const onSave = vi.fn();
        const user = userEvent.setup();
        render(<Composer initial="places-1" onSave={onSave} />);

        await user.click(screen.getByRole('button', { name: 'Draw a card' }));
        await user.selectOptions(screen.getByRole('combobox', { name: 'Theme' }), 'Places');

        expect(screen.getByRole('figure', { name: 'Places card' })).toHaveTextContent('Where do you go when you need to think?');
        expect(screen.getByText('10 cards left before the deck is shuffled')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Draw another card' }));
        expect(screen.getByRole('figure', { name: 'Places card' })).toHaveTextContent('Which street or path');
        expect(onSave).toHaveBeenLastCalledWith('places-1,gratitude-1,places-2,places-3');

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Draw a card' })).toHaveFocus();

        // Reopened, it keeps the theme; the button closes it again too
        await user.click(screen.getByRole('button', { name: 'Draw a card' }));
        expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveValue('places');
        await user.click(screen.getByRole('button', { name: 'Draw a card' }));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('says in French when a used-up theme was shuffled again', async () => {
        const smallJoys = Array.from({ length: 12 }, (_, index) => `smallJoys-${index + 1}`).join(',');
        const user = userEvent.setup();
        render(<Composer language="fr" initial={smallJoys} />);

        await user.click(screen.getByRole('button', { name: 'Tirer une carte' }));
        expect(screen.getByRole('dialog', { name: 'Cartes questions' })).toBeInTheDocument();
        await user.selectOptions(screen.getByRole('combobox', { name: 'Thème' }), 'Petits bonheurs');

        expect(screen.getByRole('figure', { name: 'Carte « Petits bonheurs »' })).toHaveTextContent('Qu’est-ce qui vous a fait sourire ce matin ?');
        expect(screen.getByText('Vous aviez tiré toutes les cartes de ce paquet : il vient d’être remélangé.')).toBeInTheDocument();

        await user.selectOptions(screen.getByRole('combobox', { name: 'Thème' }), 'Tous les thèmes');
        expect(screen.getByRole('figure', { name: 'Carte « Gratitude »' })).toBeInTheDocument();
        expect(screen.getByText('Encore 57 cartes avant de remélanger le paquet')).toBeInTheDocument();
    });

    it('closes on a press outside it', async () => {
        const user = userEvent.setup();
        render(<><Composer /><p>Outside</p></>);

        await user.click(screen.getByRole('button', { name: 'Draw a card' }));
        await user.click(screen.getByText('Outside'));
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
});
