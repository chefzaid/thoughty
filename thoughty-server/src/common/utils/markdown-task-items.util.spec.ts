import { findTaskListItems } from './markdown-task-items.util';

/** The tasks of a text as `line:state:text`, `[ ]` open and `[x]` done. */
const tasks = (...lines: string[]) =>
  findTaskListItems(lines.join('\n')).map((item) => `${item.line}:${item.checked ? 'x' : ' '}:${item.text}`);

describe('findTaskListItems', () => {
  it('reads every list marker, ticked or not, with the box column and the text after it', () => {
    const content = ['- [ ] Dash', '* [x] Star', '+ [X] Plus', '1. [ ] Dot', '2) [ ] Paren', '10. [ ]   Spaced  '].join('\n');

    expect(findTaskListItems(content)).toEqual([
      { line: 0, column: 3, checked: false, text: 'Dash' },
      { line: 1, column: 3, checked: true, text: 'Star' },
      { line: 2, column: 3, checked: true, text: 'Plus' },
      { line: 3, column: 4, checked: false, text: 'Dot' },
      { line: 4, column: 4, checked: false, text: 'Paren' },
      { line: 5, column: 5, checked: false, text: 'Spaced' },
    ]);
  });

  it('reads nested, indented, quoted and tab-separated items', () => {
    expect(tasks('- [ ] Parent', '  - [ ] Child', '    - [x] Grandchild', '   1. [ ] Three spaces in')).toEqual([
      '0: :Parent', '1: :Child', '2:x:Grandchild', '3: :Three spaces in',
    ]);
    expect(tasks('> - [ ] Quoted', '> > * [ ] Twice', '- > not a task: [ ] here')).toEqual(['0: :Quoted', '1: :Twice']);
    expect(tasks('-\t[ ] Tab', '- - [ ] Nested on one line', '1. - [ ] Ordered then bullet')).toEqual([
      '0: :Tab', '1: :Nested on one line', '2: :Ordered then bullet',
    ]);
    expect(findTaskListItems('-\t[ ] Tab')[0].column).toBe(3);
  });

  it('keeps Windows line endings out of the text', () => {
    expect(tasks('- [ ] One\r', '- [x] Two\r')).toEqual(['0: :One', '1:x:Two']);
  });

  it('refuses brackets that are no task box', () => {
    expect(tasks('- [link](https://example.com)', '- [ ]no space', '[ ] no bullet', '-[ ] no space after the bullet', '- [-] other mark', '- [  ] wide')).toEqual([]);
  });

  it('skips fenced code, with backticks or tildes, until the fence closes', () => {
    expect(tasks('```', '- [ ] Code', '```', '- [ ] After')).toEqual(['3: :After']);
    expect(tasks('~~~~ js', '- [ ] Code', '~~~', '- [ ] Still code', '~~~~~', '- [ ] After')).toEqual(['5: :After']);
    expect(tasks('```', '- [ ] Never closed')).toEqual([]);
    // A backtick fence's info string has no backticks: this is inline code, not a fence
    expect(tasks('``` a ` b', '- [ ] Not code')).toEqual(['1: :Not code']);
  });

  it('ends a fence in a list item or quote with its container', () => {
    expect(tasks('- [ ] Item', '  ```', '  - [ ] Code', '- [ ] Next item')).toEqual(['0: :Item', '3: :Next item']);
    expect(tasks('> ```', '> - [ ] Code', 'Outside', '- [ ] Task')).toEqual(['3: :Task']);
    expect(tasks('```', '> - [ ] Quote marks inside code', '```')).toEqual([]);
  });

  it('skips indented code, but not nested items or paragraph text', () => {
    expect(tasks('Intro', '', '    - [ ] Code', '\t- [ ] Tab code')).toEqual([]);
    expect(tasks('- [ ] Item', '', '      - [ ] Code inside the item')).toEqual(['0: :Item']);
    expect(tasks('- [ ] Item', '    - [ ] Nested four spaces in')).toEqual(['0: :Item', '1: :Nested four spaces in']);
    // Four spaces after a paragraph continue it: neither code nor a list item
    expect(tasks('Some text', '    - [ ] continues the text')).toEqual([]);
    // Five spaces after the marker start code inside the item
    expect(tasks('-     [ ] Code in an item')).toEqual([]);
  });

  it('follows when a list can interrupt a paragraph', () => {
    expect(tasks('Text', '- [ ] Bullet interrupts')).toEqual(['1: :Bullet interrupts']);
    expect(tasks('Text', '1. [ ] One interrupts')).toEqual(['1: :One interrupts']);
    expect(tasks('Text', '2. [ ] Two continues the text')).toEqual([]);
    expect(tasks('1. [ ] First', '2. [ ] Second')).toEqual(['0: :First', '1: :Second']);
    expect(tasks('Text', '', '2. [ ] After a blank line')).toEqual(['2: :After a blank line']);
  });

  it('reads lazy lines and headings around tasks', () => {
    expect(tasks('- [ ] Item', 'lazy text', '    - [ ] still the item')).toEqual(['0: :Item', '2: :still the item']);
    expect(tasks('> - [ ] Quoted', 'lazy text', '2. [ ] closes the quote')).toEqual(['0: :Quoted', '2: :closes the quote']);
    expect(tasks('Heading', '-', '2. [ ] After a setext heading')).toEqual(['2: :After a setext heading']);
    expect(tasks('# [ ] heading', '---', '* * *', '- [ ] Task')).toEqual(['3: :Task']);
  });

  it('closes an empty item after a blank line', () => {
    expect(tasks('-', '', '  - [ ] Not inside the empty item')).toEqual(['2: :Not inside the empty item']);
    expect(tasks('-', '', '     - [ ] Code once the empty item closed')).toEqual([]);
  });

  it('skips HTML blocks until they end', () => {
    expect(tasks('<div>', '- [ ] In the block', '', '- [ ] After')).toEqual(['3: :After']);
    expect(tasks('<!--', '- [ ] Commented out', '-->', '- [ ] After')).toEqual(['3: :After']);
    expect(tasks('<pre>', '- [ ] Raw', '</pre>', '- [ ] After')).toEqual(['3: :After']);
    expect(tasks('<!-- one line -->', '- [ ] After')).toEqual(['1: :After']);
    expect(tasks('<span class="x">', '- [ ] In a lone-tag block', '', '- [ ] After')).toEqual(['3: :After']);
    // A lone tag cannot interrupt a paragraph
    expect(tasks('Text', '<span>', '- [ ] Task')).toEqual(['2: :Task']);
  });

  it('counts a box with nothing after it only when the next line continues its text', () => {
    expect(tasks('- [ ]', '- [x] ')).toEqual([]);
    expect(tasks('- [ ] ', '  continued on the next line')).toEqual(['0: :continued on the next line']);
    expect(tasks('- [ ] ', '', '  a new paragraph')).toEqual([]);
  });

  it('reads an empty text as no task', () => {
    expect(findTaskListItems('')).toEqual([]);
  });
});
