// @ts-expect-error jsdom ships no type declarations; only its DOMParser is used, typed below
import { JSDOM } from 'jsdom';

/**
 * Gives a test running in the Node environment (for the Blob streams and Web Crypto that jsdom's own
 * environment lacks) jsdom's inert `DOMParser`, for code that reads markup.
 */
export function installDomParser(): void {
  globalThis.DOMParser = (new JSDOM('') as { window: { DOMParser: typeof DOMParser } }).window.DOMParser;
}
