import { useMemo } from 'react';
import MDEditor, { type MDEditorProps } from '@uiw/react-md-editor/nohighlight';
import type { TranslationFunction } from '../../types';
import { buildMarkdownCommands, buildMarkdownExtraCommands } from './markdownToolbar';

interface MarkdownEditorProps extends Omit<MDEditorProps, 'commands' | 'extraCommands'> {
    readonly t: TranslationFunction;
    /** Adds the toolbar button that places one of the entry's pictures. */
    readonly onInsertImage?: () => void;
}

/** The Markdown editor of the composer and the entry editor, loaded on demand with its toolbar. */
export default function MarkdownEditor({ t, onInsertImage, ...props }: MarkdownEditorProps) {
    const toolbar = useMemo(() => buildMarkdownCommands(t, onInsertImage), [t, onInsertImage]);
    const extraToolbar = useMemo(() => buildMarkdownExtraCommands(t), [t]);
    return <MDEditor {...props} commands={toolbar} extraCommands={extraToolbar} />;
}
