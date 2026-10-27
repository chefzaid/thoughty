import { createContext, useContext, useMemo, type ElementType } from 'react';
import Markdown, { type Components, type ExtraProps } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MentionLink from '../People/MentionLink';
import type { Person } from '../../services/api/peopleService';
import { remarkMentions } from '../../utils/remarkMentions';

type HastElement = NonNullable<ExtraProps['node']>;
type HastChild = HastElement['children'][number];

/** Lets the writer tick the task list items of their own entry. */
export interface MarkdownTaskList {
    /** Lines of the entry before this part of it, so that a line here is a line of the whole entry. */
    readonly lineOffset: number;
    /** The entry's task lines and whether each one is ticked. */
    readonly taskLines: ReadonlyMap<number, boolean>;
    readonly onToggle: (line: number, checked: boolean) => void;
}

interface MarkdownRendererProps {
    readonly content: string;
    readonly components?: Components;
    /** Without it, task list items show as checkboxes that cannot be changed. */
    readonly taskList?: MarkdownTaskList;
    /** The writer's people by handle: mentions of them become links. Without it, mentions stay text. */
    readonly mentionPeople?: ReadonlyMap<string, Person>;
    /** Hover text of a mention link, from the person's name. */
    readonly mentionTitle?: (person: Person) => string;
}

interface TaskItem {
    /** The item's line in this part of the entry, counted from 0. */
    readonly line: number | null;
    readonly label: string;
}

// The task list travels through context, so the components stay the same when a tick changes the
// content, and the checkbox keeps keyboard focus instead of being rendered anew.
const TaskListContext = createContext<MarkdownTaskList | undefined>(undefined);
const TaskItemContext = createContext<TaskItem | null>(null);

/** The words of a list item, without its checkbox or the lists nested in it. */
function itemText(node: HastChild): string {
    if (node.type === 'text') {
        return node.value;
    }
    if (node.type !== 'element' || ['input', 'ol', 'ul'].includes(node.tagName)) {
        return '';
    }
    return node.children.map(itemText).join('');
}

function TaskCheckbox({ checked }: Readonly<{ checked: boolean }>) {
    const taskList = useContext(TaskListContext);
    const item = useContext(TaskItemContext);
    const label = item?.label || undefined;
    const line = taskList && item?.line != null ? taskList.lineOffset + item.line : null;

    // Only a line the entry really holds as a task in this state can be ticked: a list item that
    // starts after a cross-reference in the middle of a line, for example, stays as it is.
    if (!taskList || line === null || taskList.taskLines.get(line) !== checked) {
        return <input type="checkbox" className="task-list-checkbox" checked={checked} disabled readOnly aria-label={label} />;
    }

    return (
        <input
            type="checkbox"
            className="task-list-checkbox"
            checked={checked}
            aria-label={label}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => taskList.onToggle(line, event.target.checked)}
        />
    );
}

function withTaskItems(components: Components | undefined): Components {
    const BaseItem = (components?.li ?? 'li') as ElementType;
    return {
        ...components,
        li: ({ node, ...props }) => {
            const rendered = <BaseItem {...props} />;
            if (!node || !String(props.className ?? '').split(' ').includes('task-list-item')) {
                return rendered;
            }
            const startLine = node.position?.start.line;
            const item: TaskItem = {
                line: startLine === undefined ? null : startLine - 1,
                label: node.children.map(itemText).join('').replaceAll(/\s+/g, ' ').trim(),
            };
            return <TaskItemContext.Provider value={item}>{rendered}</TaskItemContext.Provider>;
        },
        input: ({ node: _node, ...props }) => (props.type === 'checkbox'
            ? <TaskCheckbox checked={Boolean(props.checked)} />
            : <input {...props} />),
        a: ({ node, children, ...props }) => {
            const personId = Number(node?.properties?.dataMention);
            if (personId > 0) {
                return <MentionLink personId={personId} title={props.title}>{children}</MentionLink>;
            }
            return <a {...props}>{children}</a>;
        },
    };
}

const DEFAULT_COMPONENTS = withTaskItems(undefined);

const NO_PEOPLE: ReadonlyMap<string, Person> = new Map();

function MarkdownRenderer({ content, components, taskList, mentionPeople = NO_PEOPLE, mentionTitle }: Readonly<MarkdownRendererProps>) {
    const resolvedComponents = useMemo(() => (components ? withTaskItems(components) : DEFAULT_COMPONENTS), [components]);
    const remarkPlugins = useMemo(() => [remarkGfm, remarkMentions(mentionPeople, mentionTitle)], [mentionPeople, mentionTitle]);

    return (
        <span className="markdown-content">
            <TaskListContext.Provider value={taskList}>
                <Markdown remarkPlugins={remarkPlugins} components={resolvedComponents}>
                    {content}
                </Markdown>
            </TaskListContext.Provider>
        </span>
    );
}

export default MarkdownRenderer;
