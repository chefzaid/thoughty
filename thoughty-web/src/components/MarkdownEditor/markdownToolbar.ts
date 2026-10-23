import { checkedListCommand, getCommands, help, type ICommand } from '@uiw/react-md-editor/commands';
import type { TranslationFunction } from '../../types';

const labelled = (command: ICommand, label: string): ICommand => ({
    ...command,
    buttonProps: { ...command.buttonProps, 'aria-label': label, title: label },
});

/**
 * The editor's formatting toolbar: the editor's own buttons, with the task list button (which starts
 * `- [ ]` items) and the guide link named in the writer's language.
 */
export function buildMarkdownCommands(t: TranslationFunction): ICommand[] {
    return getCommands().map((command) => {
        if (command.name === checkedListCommand.name) {
            return labelled(command, t('markdownTaskListButton'));
        }
        if (command.name === help.name) {
            return labelled(command, t('markdownHelpButton'));
        }
        return command;
    });
}
