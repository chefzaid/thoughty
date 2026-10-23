import { describe, expect, it } from 'vitest';
import { isValidElement, type ReactElement } from 'react';
import { checkedListCommand, getCommands, getExtraCommands, type ICommand } from '@uiw/react-md-editor/commands';
import { getTranslation } from '../../utils/translations';
import { buildMarkdownCommands, buildMarkdownExtraCommands } from './markdownToolbar';

/** Every named button, including the entries of the heading menu. */
const flatten = (commands: ICommand[]): ICommand[] =>
    commands.flatMap((command) => [command, ...(Array.isArray(command.children) ? flatten(command.children) : [])]);

const named = (commands: ICommand[]) => flatten(commands).filter((command) => command.keyCommand !== 'divider');

describe('buildMarkdownCommands', () => {
    const translate = (language: 'en' | 'fr') => (key: string, params?: Record<string, string | number>) =>
        getTranslation(language, key, params);
    const labels = (language: 'en' | 'fr') => named([
        ...buildMarkdownCommands(translate(language)),
        ...buildMarkdownExtraCommands(translate(language)),
    ]).map((command) => command.buttonProps?.['aria-label']);

    it('keeps the editor buttons in their order, with the task list button that starts `- [ ]` items', () => {
        const toolbar = buildMarkdownCommands((key) => key);

        expect(toolbar.map((command) => command.name)).toEqual(getCommands().map((command) => command.name));
        expect(buildMarkdownExtraCommands((key) => key).map((command) => command.name))
            .toEqual(getExtraCommands().map((command) => command.name));
        const taskList = toolbar.find((command) => command.name === checkedListCommand.name);
        expect(taskList).toMatchObject({ prefix: '- [ ] ', shortcuts: 'ctrl+shift+c' });
        expect(taskList?.buttonProps).toMatchObject({ 'aria-label': 'markdownTaskListButton', title: 'markdownTaskListButton' });
    });

    it('names every button through translations, so none keeps the editor English label', () => {
        const english = named([...getCommands(), ...getExtraCommands()]).map((command) => command.buttonProps?.['aria-label']);
        const keys = named([...buildMarkdownCommands((key) => key), ...buildMarkdownExtraCommands((key) => key)])
            .map((command) => command.buttonProps?.['aria-label']);

        expect(keys).toHaveLength(english.length);
        keys.forEach((key) => expect(key).toMatch(/^markdown[A-Z]/));
        expect(labels('fr').filter((label) => english.includes(label))).toEqual([]);
    });

    it('names the buttons in English and French', () => {
        expect(labels('en')).toEqual(expect.arrayContaining([
            'Add bold text (ctrl + b)',
            'Insert a heading',
            'Insert a level 3 heading (ctrl + 3)',
            'Add a task list (ctrl + shift + c)',
            'Open the Markdown guide',
            'Toggle full screen (ctrl + 0)',
        ]));
        expect(labels('fr')).toEqual(expect.arrayContaining([
            'Mettre en gras (ctrl + b)',
            'Insérer un titre',
            'Insérer un titre de niveau 3 (ctrl + 3)',
            'Ajouter une liste de tâches (ctrl + maj + c)',
            'Ouvrir le guide Markdown',
            'Basculer en plein écran (ctrl + 0)',
        ]));
    });

    it('shows the heading menu entries with translated text and hides the icons from assistive technology', () => {
        const toolbar = buildMarkdownCommands(translate('fr'));
        const headings = toolbar.find((command) => command.name === 'title');
        const first = Array.isArray(headings?.children) ? headings.children[0] : undefined;
        expect(isValidElement(first?.icon) && (first.icon as ReactElement<{ children: string }>).props.children).toBe('Titre 1');

        const bold = toolbar.find((command) => command.name === 'bold');
        expect(isValidElement(bold?.icon) && (bold.icon as ReactElement<{ 'aria-hidden'?: boolean }>).props['aria-hidden']).toBe(true);
    });
});
