/**
 * A Markdown task list item (`- [ ] Call the bank`, `* [x] Done`, `1. [ ] First`), also inside
 * block quotes or nested lists. The groups are what comes before the box state, the state, and the rest.
 */
const TASK_LINE_PATTERN = /^((?:[\t ]*>)*[\t ]*(?:[*+-]|\d{1,9}[.)])[\t ]+\[)([ xX])(\](?:[\t \r]|$)[^\n]*)$/;

/** The content with the task on the given line (counted from 0) ticked or not; null when that line is no task. */
export function setTaskListItem(content: string, line: number, checked: boolean): string | null {
  const lines = content.split('\n');
  const match = Number.isInteger(line) && line >= 0 ? TASK_LINE_PATTERN.exec(lines[line] ?? '') : null;
  if (!match) {
    return null;
  }

  lines[line] = `${match[1]}${checked ? 'x' : ' '}${match[3]}`;
  return lines.join('\n');
}

/** The content with every task box emptied, to tell whether two versions differ only in what is ticked. */
export function withoutTaskStates(content: string): string {
  return content
    .split('\n')
    .map((text) => text.replace(TASK_LINE_PATTERN, '$1 $3'))
    .join('\n');
}
