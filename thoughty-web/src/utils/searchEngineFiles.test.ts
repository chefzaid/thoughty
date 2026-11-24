import { describe, expect, it } from 'vitest';

import { buildRobotsTxt, buildSitemap } from './searchEngineFiles';

const ORIGIN = 'https://thoughty.test';

function robotsRules(text: string) {
  return text.split('\n').filter((line) => /^(Allow|Disallow): /.test(line)).map((line) => {
    const [kind, path] = line.split(': ') as [string, string];
    return { allow: kind === 'Allow', path };
  });
}

/** Whether a crawler that follows the longest matching rule (Allow winning a tie) may read the path. */
function crawlable(text: string, path: string): boolean {
  const matching = robotsRules(text).filter((rule) => path.startsWith(rule.path));
  matching.sort((left, right) => right.path.length - left.path.length || Number(right.allow) - Number(left.allow));
  return matching[0]?.allow ?? true;
}

describe('search engine files', () => {
  it('lists each public page in both languages, each with its alternates', () => {
    const sitemap = buildSitemap(ORIGIN);
    const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);

    expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">')).toBe(true);
    expect(locs).toHaveLength(18);
    expect(locs).toEqual(expect.arrayContaining([
      `${ORIGIN}/`, `${ORIGIN}/fr/`, `${ORIGIN}/about`, `${ORIGIN}/fr/about`, `${ORIGIN}/fr/memoir-questions`,
      `${ORIGIN}/fr/journal-templates`, `${ORIGIN}/fr/blog`, `${ORIGIN}/fr/contact`, `${ORIGIN}/fr/privacy`, `${ORIGIN}/fr/terms`,
    ]));
    expect(locs.some((loc) => /login|register|journal$/.test(loc ?? ''))).toBe(false);
    expect(sitemap).toContain([
      `    <loc>${ORIGIN}/fr/about</loc>`,
      `    <xhtml:link rel="alternate" hreflang="en" href="${ORIGIN}/about"/>`,
      `    <xhtml:link rel="alternate" hreflang="fr" href="${ORIGIN}/fr/about"/>`,
      `    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/about"/>`,
    ].join('\n'));
  });

  it('escapes the address it is given', () => {
    expect(buildSitemap('https://a&b')).toContain('<loc>https://a&amp;b/</loc>');
  });

  it('lets crawlers read the public pages only, and points them to the sitemap', () => {
    const robots = buildRobotsTxt(ORIGIN);

    expect(robots.startsWith('User-agent: *\n')).toBe(true);
    expect(robots).toContain(`\nSitemap: ${ORIGIN}/sitemap.xml\n`);
    for (const path of ['/', '/fr/', '/about', '/fr/about', '/feedback', '/fr/feedback', '/memoir-questions', '/journal-templates', '/fr/journal-templates', '/blog?post=tips']) {
      expect(crawlable(robots, path), path).toBe(true);
    }
    for (const path of ['/api/entries', '/journal?diary=all', '/feed', '/memoir', '/memoir/simple', '/profile', '/login', '/register',
      '/reset-password?token=x', '/complete-sign-up', '/verify-email', '/unsubscribe', '/share-target?text=x', '/recycle-bin']) {
      expect(crawlable(robots, path), path).toBe(false);
    }
  });
});
