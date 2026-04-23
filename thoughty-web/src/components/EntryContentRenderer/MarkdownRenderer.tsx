import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
    readonly content: string;
    readonly components?: Components;
}

function MarkdownRenderer({ content, components }: Readonly<MarkdownRendererProps>) {
    return (
        <span className="markdown-content">
            <Markdown remarkPlugins={[remarkGfm]} components={components}>
                {content}
            </Markdown>
        </span>
    );
}

export default MarkdownRenderer;