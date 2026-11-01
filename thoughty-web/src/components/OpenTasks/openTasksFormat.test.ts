import { describe, expect, it } from 'vitest';

import type { OpenTask } from '../../services/api';
import { groupByEntry, openTaskKey, taskPlainText } from './openTasksFormat';

const task = (entryId: number, line: number, text = `Task ${line}`): OpenTask => ({ entryId, date: '2026-10-21', title: null, line, text });

describe('groupByEntry', () => {
  it('gathers the tasks that follow one another from one entry, in the list order', () => {
    const groups = groupByEntry([task(9, 1), task(9, 4), task(5, 0), task(9, 7)]);

    expect(groups.map((group) => [group.entryId, group.firstLine, group.tasks.map((item) => item.line)])).toEqual([
      [9, 1, [1, 4]],
      [5, 0, [0]],
      [9, 7, [7]],
    ]);
    expect(groupByEntry([])).toEqual([]);
  });
});

describe('openTaskKey', () => {
  it('tells tasks apart by entry, line and text', () => {
    expect(openTaskKey(task(9, 1, 'Call'))).toBe('9:1:Call');
    expect(openTaskKey(task(9, 1, 'Call'))).not.toBe(openTaskKey(task(9, 1, 'Write')));
  });
});

describe('taskPlainText', () => {
  it.each([
    ['**Call** the _bank_', 'Call the bank'],
    ['Read [the guide](https://example.com) and ![a map](attachment:3)', 'Read the guide and a map'],
    ['Fix `npm run build` ~~today~~', 'Fix npm run build today'],
    ['Keep snake_case_names and 2*3', 'Keep snake_case_names and 2*3'],
    ['\\*not emphasis\\*', '*not emphasis*'],
    ['  Plain words  ', 'Plain words'],
  ])('reads %j as %j', (markdown, plain) => {
    expect(taskPlainText(markdown)).toBe(plain);
  });
});
