import { useEffect } from 'react';

import { getPublicPageAlternates, getPublicPathForView, type LocalizedPublicPage } from '../types';

function headLink(rel: string, href: string, hreflang?: string): HTMLLinkElement {
  const link = document.createElement('link');
  link.rel = rel;
  link.href = href;
  if (hreflang) link.hreflang = hreflang;
  return link;
}

/**
 * Tells search engines a localized public page's own address (`canonical`, without its query) and its
 * address in each language (`alternate` with `hreflang`, the English one also for any other language), so
 * each language is indexed apart; the links go when the page does.
 */
export function usePublicPageLinks(page: LocalizedPublicPage | null): void {
  const view = page?.view;
  const language = page?.language;

  useEffect(() => {
    if (!view || !language) return undefined;
    const origin = globalThis.location.origin;
    const links = [
      headLink('canonical', origin + getPublicPathForView(view, language)),
      ...getPublicPageAlternates(view).map(({ hreflang, path }) => headLink('alternate', origin + path, hreflang)),
    ];
    document.head.append(...links);
    return () => links.forEach((link) => link.remove());
  }, [view, language]);
}
