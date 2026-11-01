/**
 * Finds the task list items of a Markdown text the way the journal's Markdown reader (micromark with
 * GitHub Flavored Markdown) does, line by line, following CommonMark's block structure: block quotes and
 * list items hold other blocks; fenced code, indented code and HTML blocks hold none; a paragraph can
 * continue lazily on a less indented line. Only what decides whether a line is a task is modelled.
 */

/** A task list item, as the journal renders it with a checkbox. */
export interface TaskListItem {
  /** The line holding it, counted from 0. */
  line: number;
  /** Where on that line the box's state (` `, `x` or `X`) is. */
  column: number;
  checked: boolean;
  /** What follows the box on its line, as written (Markdown), without the spaces around it. */
  text: string;
}

type Container =
  | { kind: 'quote' }
  /** `empty` while the item has held nothing yet (a `-` alone): a blank line then closes it. */
  | { kind: 'item'; contentColumn: number; empty: boolean };

/** A block whose lines are not read as Markdown until it ends. */
/** An HTML block: up to a line holding `end`, or up to a blank line when there is none. */
type HtmlBlock = { kind: 'html'; end: RegExp | null };
type RawBlock = { kind: 'fence'; char: string; length: number } | HtmlBlock;

interface ScanState {
  containers: Container[];
  raw: RawBlock | null;
  /** Whether the line before was paragraph text, which a later line may continue or a list may interrupt. */
  inParagraph: boolean;
  /**
   * Whether the last line with text was indented code. Indented code goes on past blank lines, and the
   * reader lets a list interrupt it only as it would a paragraph.
   */
  inIndentedCode: boolean;
}

/** One line with its tabs turned into spaces (tab stops of 4), and where each column came from. */
interface Line {
  text: string;
  source: number[];
}

const TAB_WIDTH = 4;
/** Indenting a line this far past its container makes it code (or paragraph text), never a new block. */
const CODE_INDENT = 4;
const LIST_MARKER = /^(?:[*+-]|(\d{1,9})[.)])(?= |$)/;
const TASK_BOX = /^\[([ xX])\](?= |$)/;
const FENCE_OPEN = /^(`{3,}|~{3,})(.*)$/;
const THEMATIC_BREAK = /^([*_-])(?: *\1){2,} *$/;
const HEADING = /^#{1,6}(?: |$)/;
const SETEXT_UNDERLINE = /^(?:=+|-+) *$/;

const HTML_BLOCK_NAMES = new Set([
  'address', 'article', 'aside', 'base', 'basefont', 'blockquote', 'body', 'caption', 'center', 'col', 'colgroup',
  'dd', 'details', 'dialog', 'dir', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'frame',
  'frameset', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hr', 'html', 'iframe', 'legend', 'li', 'link',
  'main', 'menu', 'menuitem', 'nav', 'noframes', 'ol', 'optgroup', 'option', 'p', 'param', 'search', 'section',
  'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'title', 'tr', 'track', 'ul',
]);
const HTML_RAW = /^<(pre|script|style|textarea)(?:[ >]|$)/i;
const HTML_SPECIAL: ReadonlyArray<[RegExp, RegExp]> = [
  [/^<!--/, /-->/],
  [/^<\?/, /\?>/],
  [/^<![A-Za-z]/, />/],
  [/^<!\[CDATA\[/, /\]\]>/],
];
const HTML_BLOCK_TAG = /^<\/?([A-Za-z][A-Za-z0-9]*)(?: |\/?>|$)/;
const HTML_ATTRIBUTE = ` +[A-Za-z_:][\\w.:-]*(?: *= *(?:[^ "'=<>\`]+|'[^']*'|"[^"]*"))?`;
const HTML_LONE_TAG = new RegExp(`^(?:<[A-Za-z][A-Za-z0-9-]*(?:${HTML_ATTRIBUTE})* */?>|</[A-Za-z][A-Za-z0-9-]*\\s*>) *$`);

function expandTabs(raw: string): Line {
  let text = '';
  const source: number[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    const width = char === '\t' ? TAB_WIDTH - (text.length % TAB_WIDTH) : 1;
    text += char === '\t' ? ' '.repeat(width) : char;
    for (let step = 0; step < width; step += 1) {
      source.push(index);
    }
  }
  return { text: text.replace(/\r$/, ''), source };
}

function indentAt(text: string, position: number): number {
  let end = position;
  while (text[end] === ' ') {
    end += 1;
  }
  return end - position;
}

/** The HTML block a line starts, if any; the last kind cannot interrupt a paragraph. */
function htmlBlockStart(rest: string, inParagraph: boolean): HtmlBlock | null {
  if (!rest.startsWith('<')) {
    return null;
  }
  const raw = HTML_RAW.exec(rest);
  if (raw) {
    return { kind: 'html', end: new RegExp(`</(?:pre|script|style|textarea)>`, 'i') };
  }
  const special = HTML_SPECIAL.find(([start]) => start.test(rest));
  if (special) {
    return { kind: 'html', end: special[1] };
  }
  const tag = HTML_BLOCK_TAG.exec(rest);
  if ((tag && HTML_BLOCK_NAMES.has(tag[1].toLowerCase())) || (!inParagraph && HTML_LONE_TAG.test(rest))) {
    return { kind: 'html', end: null };
  }
  return null;
}

/** Whether text at this indentation starts a block of its own, so it cannot continue a paragraph lazily. */
function startsLeafBlock(rest: string, indent: number): boolean {
  return indent < CODE_INDENT && (FENCE_OPEN.test(rest) || HEADING.test(rest) || THEMATIC_BREAK.test(rest)
    || htmlBlockStart(rest, true) !== null);
}

/** Whether a quote or list item starts here (a list that interrupts nothing). */
function startsContainer(rest: string, indent: number): boolean {
  return indent < CODE_INDENT && (rest.startsWith('>') || (LIST_MARKER.test(rest) && !THEMATIC_BREAK.test(rest)));
}

/** How many of the open containers the line continues, and the column it is read from after them. */
function matchContainers(state: ScanState, text: string, blank: boolean): { matched: number; cursor: number } {
  let cursor = 0;
  let matched = 0;
  for (const container of state.containers) {
    const indent = indentAt(text, cursor);
    if (container.kind === 'quote') {
      if (indent >= CODE_INDENT || text[cursor + indent] !== '>') {
        break;
      }
      cursor += indent + 1;
      cursor += text[cursor] === ' ' ? 1 : 0;
    } else if (blank ? container.empty : cursor + indent < container.contentColumn) {
      break;
    } else if (!blank) {
      cursor = container.contentColumn;
    }
    matched += 1;
  }
  return { matched, cursor };
}

/**
 * Opens the quotes and list items starting at the cursor. Returns the new cursor and whether the last
 * container opened is a list item whose text starts there, where a task box would be.
 */
function openContainers(state: ScanState, text: string, start: number, interrupts: boolean): { cursor: number; opened: boolean; inItem: boolean } {
  let cursor = start;
  let opened = false;
  let inItem = false;
  // Only the first container can interrupt a paragraph; the ones after it start inside it
  for (let restricted = interrupts; ; restricted = false) {
    const indent = indentAt(text, cursor);
    const rest = text.slice(cursor + indent);
    if (indent >= CODE_INDENT) {
      break;
    }
    if (rest.startsWith('>')) {
      state.containers.push({ kind: 'quote' });
      cursor += indent + 1;
      cursor += text[cursor] === ' ' ? 1 : 0;
      opened = true;
      inItem = false;
      continue;
    }
    const marker = LIST_MARKER.exec(rest);
    if (!marker || THEMATIC_BREAK.test(rest)) {
      break;
    }
    const after = cursor + indent + marker[0].length;
    const empty = text.slice(after).trim() === '';
    // A new list may interrupt a paragraph only with a bullet or "1.", and only when the item is not empty
    if (restricted && (empty || (marker[1] !== undefined && Number(marker[1]) !== 1))) {
      break;
    }
    const spaces = indentAt(text, after);
    // Five spaces or more after the marker start indented code inside the item, one space in
    const contentColumn = empty || spaces > CODE_INDENT ? after + 1 : after + spaces;
    state.containers.push({ kind: 'item', contentColumn, empty });
    opened = true;
    cursor = Math.min(contentColumn, text.length);
    inItem = !empty && spaces <= CODE_INDENT;
    if (!inItem) {
      break;
    }
  }
  return { cursor, opened, inItem };
}

/** Reads a line of a fenced code or HTML block that the line's containers still hold; true when the line is part of it. */
function readRawLine(state: ScanState, raw: RawBlock, rest: string, indent: number, blank: boolean): boolean {
  if (raw.kind === 'fence') {
    if (indent < CODE_INDENT && new RegExp(`^\\${raw.char}{${raw.length},} *$`).test(rest)) {
      state.raw = null;
    }
    return true;
  }
  if (raw.end === null && blank) {
    state.raw = null;
    return false;
  }
  if (raw.end?.test(rest)) {
    state.raw = null;
  }
  return true;
}

/**
 * Reads what a line holds once its containers are matched or opened (code, a heading, a paragraph...)
 * and returns its text when it continues the paragraph above.
 */
function readLeaf(state: ScanState, rest: string, indent: number, changes: { closed: boolean; opened: boolean }): string | null {
  const continues = state.inParagraph && !changes.closed && !changes.opened;
  const wasCode = state.inIndentedCode;
  state.inIndentedCode = false;
  if (rest === '') {
    state.inParagraph = false;
    state.inIndentedCode = wasCode && !changes.closed && !changes.opened;
    return null;
  }
  if (indent >= CODE_INDENT) {
    // Code left behind by a quote or list item this line closed starts afresh: a list can follow it freely
    state.inIndentedCode = !continues && (changes.opened || !changes.closed);
    return continues ? rest.trim() : null;
  }
  const fence = FENCE_OPEN.exec(rest);
  if (fence && !(fence[1].startsWith('`') && fence[2].includes('`'))) {
    state.raw = { kind: 'fence', char: fence[1][0], length: fence[1].length };
    state.inParagraph = false;
    return null;
  }
  const html = htmlBlockStart(rest, state.inParagraph);
  if (html) {
    state.raw = html.end?.test(rest.slice(1)) ? null : html;
    state.inParagraph = false;
    return null;
  }
  if ((continues && SETEXT_UNDERLINE.test(rest)) || HEADING.test(rest) || THEMATIC_BREAK.test(rest)) {
    state.inParagraph = false;
    return null;
  }
  state.inParagraph = true;
  return continues ? rest.trim() : null;
}

interface LineResult {
  task: Omit<TaskListItem, 'line'> | null;
  continuation: string | null;
}

function scanLine(state: ScanState, { text, source }: Line): LineResult {
  const blank = text.trim() === '';
  const { matched, cursor: matchedCursor } = matchContainers(state, text, blank);
  const allMatched = matched === state.containers.length;
  const indent = indentAt(text, matchedCursor);
  const rest = text.slice(matchedCursor + indent);

  if (state.raw && allMatched && readRawLine(state, state.raw, rest, indent, blank)) {
    return { task: null, continuation: null };
  }
  state.raw = null;

  // A line its containers do not hold continues the paragraph above when it starts nothing new
  if (!allMatched && !blank && state.inParagraph && !startsContainer(rest, indent) && !startsLeafBlock(rest, indent)) {
    return { task: null, continuation: rest.trim() };
  }

  const closed = !allMatched;
  if (closed) {
    state.containers.length = matched;
    state.inParagraph = false;
    state.inIndentedCode = false;
  }
  if (!blank) {
    state.containers.forEach((container) => {
      if (container.kind === 'item') {
        container.empty = false;
      }
    });
  }

  const interrupts = !closed && (state.inParagraph || state.inIndentedCode);
  const { cursor, opened, inItem } = openContainers(state, text, matchedCursor, interrupts);
  const leafIndent = indentAt(text, cursor);
  const leaf = text.slice(cursor + leafIndent);
  const box = inItem ? TASK_BOX.exec(leaf) : null;
  if (box) {
    state.inParagraph = true;
    state.inIndentedCode = false;
    const column = source[cursor + leafIndent + 1];
    return { task: { column, checked: box[1] !== ' ', text: leaf.slice(box[0].length).trim() }, continuation: null };
  }
  if (opened) {
    state.inParagraph = false;
  }
  return { task: null, continuation: readLeaf(state, leaf, leafIndent, { closed, opened }) };
}

/**
 * The task list items of a Markdown text (`- [ ] Call the bank`, `* [x] Done`, `1. [ ] First`), also nested
 * or in block quotes, in the order they appear. Lines in fenced or indented code, in HTML blocks or that
 * the reader takes as plain text are left out, so the list matches the checkboxes the entry shows.
 */
export function findTaskListItems(content: string): TaskListItem[] {
  const state: ScanState = { containers: [], raw: null, inParagraph: false, inIndentedCode: false };
  const items: TaskListItem[] = [];
  // A box with nothing after it on its line is a task only when the next line continues its text
  let waiting: TaskListItem | null = null;
  content.split('\n').forEach((raw, line) => {
    const { task, continuation } = scanLine(state, expandTabs(raw));
    if (waiting && continuation) {
      items.push({ ...waiting, text: continuation });
    }
    waiting = null;
    if (task?.text) {
      items.push({ line, ...task });
    } else if (task) {
      waiting = { line, ...task };
    }
  });
  return items;
}
