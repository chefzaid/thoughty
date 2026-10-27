import { findMentions, personJournalPath } from './mentions';

/** The parts of a Markdown syntax tree this plugin reads and writes. */
interface MarkdownNode {
    type: string;
    value?: string;
    url?: string;
    children?: MarkdownNode[];
    data?: { hProperties?: Record<string, string> };
}

/** Text inside these stays as it is: a mention there would be a link inside a link. */
const LINK_TYPES = new Set(['link', 'linkReference']);

interface MentionedPerson {
    readonly id: number;
}

type MentionTitle<P> = ((person: P) => string) | undefined;

function splitMentions<P extends MentionedPerson>(node: MarkdownNode, people: ReadonlyMap<string, P>, title: MentionTitle<P>): MarkdownNode[] {
    const text = node.value ?? '';
    const parts: MarkdownNode[] = [];
    let at = 0;
    for (const mention of findMentions(text)) {
        const person = people.get(mention.handle);
        if (!person) continue;
        if (mention.start > at) parts.push({ type: 'text', value: text.slice(at, mention.start) });
        parts.push({
            type: 'link',
            url: personJournalPath(person.id),
            data: { hProperties: { dataMention: String(person.id), ...(title ? { title: title(person) } : {}) } },
            children: [{ type: 'text', value: text.slice(mention.start, mention.end) }],
        });
        at = mention.end;
    }
    if (parts.length === 0) return [node];
    if (at < text.length) parts.push({ type: 'text', value: text.slice(at) });
    return parts;
}

function linkMentions<P extends MentionedPerson>(node: MarkdownNode, people: ReadonlyMap<string, P>, title: MentionTitle<P>): void {
    if (!node.children || LINK_TYPES.has(node.type)) return;
    node.children = node.children.flatMap((child) => {
        if (child.type === 'text') return splitMentions(child, people, title);
        linkMentions(child, people, title);
        return [child];
    });
}

/**
 * A remark plugin that turns mentions of the given people into links to the entries about them, with
 * the hover text `title` gives. Code
 * keeps its own node types, so mentions there are never read, nor inside links.
 */
export function remarkMentions<P extends MentionedPerson>(people: ReadonlyMap<string, P>, title?: (person: P) => string) {
    return () => (tree: MarkdownNode) => {
        if (people.size > 0) linkMentions(tree, people, title);
    };
}
