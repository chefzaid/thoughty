import { useMemo } from 'react';
import MDEditor, { type MDEditorProps } from '@uiw/react-md-editor/nohighlight';
import type { TranslationFunction } from '../../types';
import { buildMarkdownCommands } from './markdownToolbar';

interface MarkdownEditorProps extends Omit<MDEditorProps, 'commands'> {
    readonly t: TranslationFunction;
}

/** The Markdown editor of the composer and the entry editor, loaded on demand with its toolbar. */
export default function MarkdownEditor({ t, ...props }: MarkdownEditorProps) {
    const toolbar = useMemo(() => buildMarkdownCommands(t), [t]);
    return <MDEditor {...props} commands={toolbar} />;
}
