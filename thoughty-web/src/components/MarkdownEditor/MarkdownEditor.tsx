import { useMemo } from 'react';
import MDEditor, { type MDEditorProps } from '@uiw/react-md-editor/nohighlight';
import type { TranslationFunction } from '../../types';
import { entrySpacingVariables, type EntrySpacing } from '../../types/config';
import { buildMarkdownCommands, buildMarkdownExtraCommands } from './markdownToolbar';
import './MarkdownEditor.css';

interface MarkdownEditorProps extends Omit<MDEditorProps, 'commands' | 'extraCommands'> {
    readonly t: TranslationFunction;
    /** Adds the toolbar button that places one of the entry's pictures. */
    readonly onInsertImage?: () => void;
    /** The writer's line and letter spacing for the text. */
    readonly spacing?: EntrySpacing;
}

/** The Markdown editor of the composer and the entry editor, loaded on demand with its toolbar. */
export default function MarkdownEditor({ t, onInsertImage, spacing = {}, className, style, ...props }: MarkdownEditorProps) {
    const toolbar = useMemo(() => buildMarkdownCommands(t, onInsertImage), [t, onInsertImage]);
    const extraToolbar = useMemo(() => buildMarkdownExtraCommands(t), [t]);
    return (
        <MDEditor
            {...props}
            className={className ? `entry-text-spacing ${className}` : 'entry-text-spacing'}
            style={{ ...style, ...entrySpacingVariables(spacing) }}
            commands={toolbar}
            extraCommands={extraToolbar}
        />
    );
}
