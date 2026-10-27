import { cloneElement, createElement, isValidElement, type ReactElement, type SVGProps } from 'react';
import { getCommands, getExtraCommands, type ICommand } from '@uiw/react-md-editor/commands';
import type { TranslationFunction } from '../../types';

/** Translation key of each toolbar button, by the editor's command name. */
const COMMAND_LABELS: Record<string, string> = {
    bold: 'markdownToolbarBold',
    italic: 'markdownToolbarItalic',
    strikethrough: 'markdownToolbarStrikethrough',
    hr: 'markdownToolbarRule',
    title: 'markdownToolbarHeadings',
    link: 'markdownToolbarLink',
    quote: 'markdownToolbarQuote',
    code: 'markdownToolbarCode',
    codeBlock: 'markdownToolbarCodeBlock',
    comment: 'markdownToolbarComment',
    image: 'markdownToolbarImage',
    table: 'markdownToolbarTable',
    'unordered-list': 'markdownToolbarBulletList',
    'ordered-list': 'markdownToolbarNumberedList',
    'checked-list': 'markdownTaskListButton',
    help: 'markdownHelpButton',
    edit: 'markdownToolbarEditOnly',
    live: 'markdownToolbarEditAndPreview',
    preview: 'markdownToolbarPreviewOnly',
    fullscreen: 'markdownToolbarFullscreen',
};

const HEADING = /^heading([1-6])$/;

/** Names the button; its icon is decoration, since the editor draws it as an unnamed `role="img"`. */
const labelled = (command: ICommand, label: string): ICommand => ({
    ...command,
    buttonProps: { ...command.buttonProps, 'aria-label': label, title: label },
    icon: isValidElement(command.icon)
        ? cloneElement(command.icon as ReactElement<SVGProps<SVGSVGElement>>, { 'aria-hidden': true })
        : command.icon,
});

/**
 * Names a button in the writer's language. The heading menu's entries show their name as text
 * ("Heading 1") instead of an icon, so that text is replaced. Dividers have no name and stay as they are.
 */
function translateCommand(command: ICommand, t: TranslationFunction): ICommand {
    const level = HEADING.exec(command.name ?? '')?.[1];
    if (level) {
        const label = t('markdownToolbarHeading', { level, shortcut: level });
        const icon = isValidElement(command.icon)
            ? cloneElement(command.icon, undefined, t('markdownToolbarHeadingLevel', { level }))
            : command.icon;
        return { ...command, buttonProps: { ...command.buttonProps, 'aria-label': label, title: label }, icon };
    }

    const key = command.name ? COMMAND_LABELS[command.name] : undefined;
    const translated = key ? labelled(command, t(key)) : command;
    if (Array.isArray(command.children)) {
        return { ...translated, children: command.children.map((child) => translateCommand(child, t)) };
    }
    return translated;
}

/** Opens the dialog that places one of the entry's pictures at the caret. */
function inlineImageCommand(onInsertImage: () => void, t: TranslationFunction): ICommand {
    const label = t('markdownToolbarInlineImage');
    return {
        name: 'inline-image',
        keyCommand: 'inline-image',
        buttonProps: { 'aria-label': label, title: label, 'aria-haspopup': 'dialog' },
        icon: createElement('span', { className: 'codicon codicon-file-media', 'aria-hidden': true }),
        execute: () => onInsertImage(),
    };
}

/**
 * The editor's formatting toolbar: the editor's own buttons in their order, every one named in the
 * writer's language, including the task list button (which starts `- [ ]` items) and the guide link.
 * With `onInsertImage`, a button after the image one places one of the entry's own pictures.
 */
export function buildMarkdownCommands(t: TranslationFunction, onInsertImage?: () => void): ICommand[] {
    return getCommands().flatMap((command) => {
        const translated = translateCommand(command, t);
        return command.name === 'image' && onInsertImage ? [translated, inlineImageCommand(onInsertImage, t)] : [translated];
    });
}

/** The buttons at the right end of the toolbar (edit, preview, full screen), named the same way. */
export function buildMarkdownExtraCommands(t: TranslationFunction): ICommand[] {
    return getExtraCommands().map((command) => translateCommand(command, t));
}
