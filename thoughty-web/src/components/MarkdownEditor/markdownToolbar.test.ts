import { describe, expect, it } from 'vitest';
import { checkedListCommand, getCommands } from '@uiw/react-md-editor/commands';
import { getTranslation } from '../../utils/translations';
import { buildMarkdownCommands } from './markdownToolbar';

describe('buildMarkdownCommands', () => {
    const labels = (language: 'en' | 'fr') => buildMarkdownCommands((key, params) => getTranslation(language, key, params))
        .map((command) => command.buttonProps?.['aria-label']);

    it('keeps the editor buttons in their order, with the task list button that starts `- [ ]` items', () => {
        const toolbar = buildMarkdownCommands((key) => key);

        expect(toolbar.map((command) => command.name)).toEqual(getCommands().map((command) => command.name));
        const taskList = toolbar.find((command) => command.name === checkedListCommand.name);
        expect(taskList).toMatchObject({ prefix: '- [ ] ', shortcuts: 'ctrl+shift+c' });
        expect(taskList?.buttonProps).toMatchObject({ 'aria-label': 'markdownTaskListButton', title: 'markdownTaskListButton' });
    });

    it('names the task list button and the guide link in English and French', () => {
        expect(labels('en')).toEqual(expect.arrayContaining(['Add a task list (ctrl + shift + c)', 'Open the Markdown guide']));
        expect(labels('fr')).toEqual(expect.arrayContaining(['Ajouter une liste de tâches (ctrl + maj + c)', 'Ouvrir le guide Markdown']));
    });
});
