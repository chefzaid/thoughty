/**
 * A Markdown task list item (`- [ ] Call the bank`, `* [x] Done`, `1. [ ] First`), also inside block
 * quotes or nested lists. The server reads task lines with the same pattern
 * (`thoughty-server/src/common/utils/entry-task-list.util.ts`).
 */
const TASK_LINE_PATTERN = /^((?:[\t ]*>)*[\t ]*(?:[*+-]|\d{1,9}[.)])[\t ]+\[)([ xX])(\](?:[\t \r]|$)[^\n]*)$/;

/** The task lines of an entry (counted from 0) and whether each one is ticked. */
export function findTaskLines(content: string): Map<number, boolean> {
    const lines = new Map<number, boolean>();
    content.split('\n').forEach((text, line) => {
        const match = TASK_LINE_PATTERN.exec(text);
        if (match) {
            lines.set(line, match[2] !== ' ');
        }
    });
    return lines;
}

/** The content with the task on the given line ticked or not; null when that line is no task. */
export function setTaskLine(content: string, line: number, checked: boolean): string | null {
    const lines = content.split('\n');
    const match = TASK_LINE_PATTERN.exec(lines[line] ?? '');
    if (!match) {
        return null;
    }
    lines[line] = `${match[1]}${checked ? 'x' : ' '}${match[3]}`;
    return lines.join('\n');
}

/** How many lines come before a position in the text, to turn a line inside a part into a line of the whole. */
export function countLinesBefore(content: string, position: number): number {
    let count = 0;
    for (let index = content.indexOf('\n'); index !== -1 && index < position; index = content.indexOf('\n', index + 1)) {
        count += 1;
    }
    return count;
}
