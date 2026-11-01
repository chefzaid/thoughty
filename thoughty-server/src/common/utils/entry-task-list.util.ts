import { findTaskListItems, type TaskListItem } from './markdown-task-items.util';

export { findTaskListItems, type TaskListItem };

/** The task on the given line (counted from 0), or null when that line holds none. */
export function findTaskListItem(content: string, line: number): TaskListItem | null {
  if (!Number.isInteger(line) || line < 0) {
    return null;
  }
  return findTaskListItems(content).find((item) => item.line === line) ?? null;
}

function withBoxes(content: string, items: readonly TaskListItem[], state: (item: TaskListItem) => string): string {
  const lines = content.split('\n');
  for (const item of items) {
    const text = lines[item.line];
    lines[item.line] = `${text.slice(0, item.column)}${state(item)}${text.slice(item.column + 1)}`;
  }
  return lines.join('\n');
}

/**
 * The content with the task on the given line ticked or not; null when that line is no task, or, when
 * `expectedText` is given, when the task there no longer reads that way (the entry changed meanwhile).
 */
export function setTaskListItem(content: string, line: number, checked: boolean, expectedText?: string): string | null {
  const item = findTaskListItem(content, line);
  if (!item || (expectedText !== undefined && item.text !== expectedText.trim())) {
    return null;
  }
  return withBoxes(content, [item], () => (checked ? 'x' : ' '));
}

/** The content with every task box emptied, to tell whether two versions differ only in what is ticked. */
export function withoutTaskStates(content: string): string {
  return withBoxes(content, findTaskListItems(content), () => ' ');
}
