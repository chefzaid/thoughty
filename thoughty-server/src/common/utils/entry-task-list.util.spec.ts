import { findTaskListItem, setTaskListItem, withoutTaskStates } from './entry-task-list.util';

describe('entry-task-list.util', () => {
  const content = ['# Errands', '', '- [ ] Call the bank', '- [x] Post the letter', '  * [X] Nested', '> 1. [ ] Quoted', 'Plain line'].join('\n');

  it('ticks and unticks the task on a line', () => {
    expect(setTaskListItem(content, 2, true)?.split('\n')[2]).toBe('- [x] Call the bank');
    expect(setTaskListItem(content, 3, false)?.split('\n')[3]).toBe('- [ ] Post the letter');
    expect(setTaskListItem(content, 4, false)?.split('\n')[4]).toBe('  * [ ] Nested');
    expect(setTaskListItem(content, 5, true)?.split('\n')[5]).toBe('> 1. [x] Quoted');
  });

  it('leaves every other line as it was, including Windows line endings', () => {
    const windows = '- [ ] One\r\n- [ ] Two\r\n';
    expect(setTaskListItem(windows, 1, true)).toBe('- [ ] One\r\n- [x] Two\r\n');
    expect(setTaskListItem(content, 2, true)?.split('\n').filter((_, index) => index !== 2))
      .toEqual(content.split('\n').filter((_, index) => index !== 2));
  });

  it.each([
    ['a heading', 0],
    ['an empty line', 1],
    ['plain text', 6],
    ['a line past the end', 20],
    ['a negative line', -1],
    ['a fraction', 1.5],
  ])('refuses %s', (_, line) => {
    expect(setTaskListItem(content, line, true)).toBeNull();
  });

  it('refuses brackets that are not a task box', () => {
    expect(setTaskListItem('- [link](https://example.com)', 0, true)).toBeNull();
    expect(setTaskListItem('- [ ]no space', 0, true)).toBeNull();
    expect(setTaskListItem('[ ] no bullet', 0, true)).toBeNull();
  });

  it('refuses task-like lines in code, which the entry shows as code', () => {
    const code = ['```', '- [ ] Not a task', '```', '    - [ ] Indented code'].join('\n');
    expect(setTaskListItem(code, 1, true)).toBeNull();
    expect(setTaskListItem(`Intro\n\n${code}`, 6, true)).toBeNull();
  });

  it('ticks a task only while it still reads as expected', () => {
    expect(setTaskListItem(content, 2, true, 'Call the bank')?.split('\n')[2]).toBe('- [x] Call the bank');
    expect(setTaskListItem(content, 2, true, '  Call the bank ')?.split('\n')[2]).toBe('- [x] Call the bank');
    expect(setTaskListItem(content, 2, true, 'Call the plumber')).toBeNull();
    expect(setTaskListItem(content, 6, true, 'Plain line')).toBeNull();
  });

  it('ticks a task nested on its bullet line at its own box', () => {
    expect(setTaskListItem('- - [ ] Nested', 0, true)).toBe('- - [x] Nested');
  });

  it('finds the task on a line', () => {
    expect(findTaskListItem(content, 5)).toEqual({ line: 5, column: 6, checked: false, text: 'Quoted' });
    expect(findTaskListItem(content, 6)).toBeNull();
    expect(findTaskListItem(content, -1)).toBeNull();
  });

  it('empties every box, so versions that differ only in ticks compare equal', () => {
    const ticked = setTaskListItem(content, 2, true) as string;
    expect(withoutTaskStates(ticked)).toBe(withoutTaskStates(content));
    expect(withoutTaskStates(content)).toContain('- [ ] Post the letter');
    expect(withoutTaskStates(`${content} again`)).not.toBe(withoutTaskStates(content));
  });
});
