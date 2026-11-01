import { inflateSync } from 'node:zlib';

/**
 * The text a book PDF draws, one string per text run, in drawing order: each content stream inflated,
 * and the WinAnsi glyph codes of its `TJ` arrays read back as Latin-1, which is what the standard
 * fonts the books use encode.
 */
export function pdfTextRuns(pdf: Buffer): string[] {
  const runs: string[] = [];
  for (const [, stream] of pdf.toString('latin1').matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let content: string;
    try {
      content = inflateSync(Buffer.from(stream, 'latin1')).toString('latin1');
    } catch {
      continue; // An image, not text
    }
    for (const [, array] of content.matchAll(/\[([^\]]*)\] TJ/g)) {
      runs.push([...array.matchAll(/<([0-9a-f]*)>/g)].map(([, hex]) => Buffer.from(hex, 'hex').toString('latin1')).join(''));
    }
  }
  return runs;
}
