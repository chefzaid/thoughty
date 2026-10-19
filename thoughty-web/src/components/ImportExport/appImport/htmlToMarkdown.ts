// Converts the HTML that Journey stores into Markdown. The document is parsed
// inert (no scripts run, nothing loads) and only text and safe links are kept.

const SAFE_LINK = /^(https?:|mailto:)/i;
const HEADINGS: Record<string, number> = { H1: 1, H2: 2, H3: 3, H4: 4, H5: 5, H6: 6 };
const BLOCKS = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'FIGURE', 'FIGCAPTION']);
const DROPPED = new Set(['IMG', 'SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'SVG', 'VIDEO', 'AUDIO']);

function escapeText(text: string): string {
  return text
    .replaceAll(/([\\`*[\]])/g, String.raw`\$1`)
    .replaceAll(/(?<!\w)_|_(?!\w)/g, String.raw`\_`);
}

function block(text: string): string {
  return text ? `\n\n${text}\n\n` : '';
}

function emphasis(marker: string, text: string): string {
  const inner = text.trim();
  if (!inner) {
    return text;
  }
  const leading = text.startsWith(' ') ? ' ' : '';
  const trailing = text.endsWith(' ') ? ' ' : '';
  return `${leading}${marker}${inner}${marker}${trailing}`;
}

function listItems(list: Element, ordered: boolean): string {
  let number = 1;
  return [...list.children]
    .filter((child) => child.tagName === 'LI')
    .map((item) => {
      const prefix = ordered ? `${number++}. ` : '- ';
      const body = renderChildren(item).replaceAll(/\n{2,}/g, '\n').trim();
      return prefix + body.replaceAll('\n', `\n${' '.repeat(prefix.length)}`);
    })
    .join('\n');
}

function renderElement(element: Element): string {
  const tag = element.tagName.toUpperCase();
  if (DROPPED.has(tag)) {
    return '';
  }
  if (HEADINGS[tag]) {
    return block(`${'#'.repeat(HEADINGS[tag])} ${renderChildren(element).trim()}`);
  }
  if (BLOCKS.has(tag)) {
    return block(renderChildren(element).trim());
  }

  switch (tag) {
    case 'BR':
      return '\n';
    case 'STRONG':
    case 'B':
      return emphasis('**', renderChildren(element));
    case 'EM':
    case 'I':
      return emphasis('*', renderChildren(element));
    case 'S':
    case 'DEL':
    case 'STRIKE':
      return emphasis('~~', renderChildren(element));
    case 'CODE':
      return `\`${(element.textContent ?? '').replaceAll('`', "'")}\``;
    case 'A': {
      const text = renderChildren(element);
      const href = element.getAttribute('href')?.trim() ?? '';
      return SAFE_LINK.test(href) && text.trim()
        ? `[${text.trim()}](${href.replaceAll(/[\s()<>]/g, (character) => encodeURIComponent(character))})`
        : text;
    }
    case 'UL':
    case 'OL':
      return block(listItems(element, tag === 'OL'));
    case 'BLOCKQUOTE':
      return block(
        renderChildren(element)
          .trim()
          .replaceAll(/\n{3,}/g, '\n\n')
          .split('\n')
          .map((line) => (line ? `> ${line}` : '>'))
          .join('\n'),
      );
    case 'PRE':
      return block(`\`\`\`\n${(element.textContent ?? '').replace(/\n$/, '')}\n\`\`\``);
    case 'HR':
      return block('---');
    default:
      return renderChildren(element);
  }
}

function renderChildren(node: Node): string {
  let markdown = '';
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      markdown += escapeText((child.textContent ?? '').replaceAll(/\s+/g, ' '));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      markdown += renderElement(child as Element);
    }
  }
  return markdown;
}

export function looksLikeHtml(text: string): boolean {
  return /<\/?(p|div|br|span|strong|em|b|i|u|ul|ol|li|h[1-6]|blockquote|a)\b[^>]*>/i.test(text);
}

export function htmlToMarkdown(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  return renderChildren(document.body)
    .replaceAll(/[ \t]+$/gm, '')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim();
}
