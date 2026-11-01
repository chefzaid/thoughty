import type { OpenTask } from '../../services/api';

/** The tasks of one entry, in a run of the list. */
export interface OpenTaskGroup {
  readonly entryId: number;
  readonly date: string;
  readonly title: string | null;
  /** The line of its first task here, which names the group on the page. */
  readonly firstLine: number;
  readonly tasks: readonly OpenTask[];
}

/** Gathers the tasks that follow one another from the same entry, keeping the list's order. */
export function groupByEntry(tasks: readonly OpenTask[]): OpenTaskGroup[] {
  const groups: Array<OpenTaskGroup & { tasks: OpenTask[] }> = [];
  for (const task of tasks) {
    const last = groups.at(-1);
    if (last?.entryId === task.entryId) {
      last.tasks.push(task);
    } else {
      groups.push({ entryId: task.entryId, date: task.date, title: task.title, firstLine: task.line, tasks: [task] });
    }
  }
  return groups;
}

/** Names a task on the page: its entry, line and text, which the API checks before ticking it. */
export function openTaskKey(task: OpenTask): string {
  return `${task.entryId}:${task.line}:${task.text}`;
}

/** A task's Markdown as the words it shows: links and pictures as their text, without emphasis or code marks. */
export function taskPlainText(text: string): string {
  // Escaped marks (`\*`) are words: set aside while the marks go, then put back as written
  const escaped: string[] = [];
  return text
    .replaceAll(/\\([\\`*_[\]()#+\-.!>~|])/g, (_, mark: string) => `\uE000${escaped.push(mark) - 1}\uE000`)
    .replaceAll(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/\*\*|__|~~|`/g, '')
    .replaceAll(/(^|[\s(])[*_](?=\S)/g, '$1')
    .replaceAll(/(\S)[*_](?=[\s).,!?:;]|$)/g, '$1')
    .replaceAll(/\uE000(\d+)\uE000/g, (_, index: string) => escaped[Number(index)] ?? '')
    .trim();
}
