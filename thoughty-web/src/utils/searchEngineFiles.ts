import {
  getPublicPageAlternates,
  LOCALIZED_PUBLIC_VIEWS,
  PAGE_LANGUAGES,
  PUBLIC_VIEW_PATHS,
  getPublicPathForView,
  VIEW_PATHS,
  type PublicViewType,
} from '../types/navigation.ts';

/**
 * Stands for the site's own address (`https://host`) in the `sitemap.xml` and `robots.txt` the build writes,
 * since one image serves any domain: NGINX puts the address of each request in its place
 * (`nginx.conf`), and the dev server writes the files with its own address.
 */
export const SITE_ORIGIN_PLACEHOLDER = '__THOUGHTY_SITE_ORIGIN__';

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** Every localized public page in every language, each listing its other languages (`xhtml:link`). */
export function buildSitemap(origin: string): string {
  const urls = LOCALIZED_PUBLIC_VIEWS.flatMap((view) => {
    const alternates = getPublicPageAlternates(view)
      .map(({ hreflang, path }) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(origin + path)}"/>`)
      .join('\n');
    return PAGE_LANGUAGES.map((language) => [
      '  <url>',
      `    <loc>${escapeXml(origin + getPublicPathForView(view, language))}</loc>`,
      alternates,
      '  </url>',
    ].join('\n'));
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

/** The public pages that are not for search engines: signing in or up, and the pages emailed links open. */
const UNLISTED_PUBLIC_VIEWS = (Object.keys(PUBLIC_VIEW_PATHS) as PublicViewType[])
  .filter((view) => !(LOCALIZED_PUBLIC_VIEWS as readonly PublicViewType[]).includes(view));

/**
 * Lets crawlers read the localized public pages and keeps them out of the API, the signed-in app, the
 * sign-in, sign-up and emailed-link pages and the installed app's share target. Paths match by prefix, and
 * the longest rule wins, so the public pages are allowed by name: `/feed` would otherwise close `/feedback`.
 */
export function buildRobotsTxt(origin: string): string {
  const allowed = LOCALIZED_PUBLIC_VIEWS.flatMap((view) => PAGE_LANGUAGES.map((language) => getPublicPathForView(view, language)));
  const disallowed = [
    '/api/',
    ...Object.values(VIEW_PATHS),
    ...UNLISTED_PUBLIC_VIEWS.map((view) => PUBLIC_VIEW_PATHS[view]),
    '/share-target',
  ];
  return [
    'User-agent: *',
    ...allowed.map((path) => `Allow: ${path}`),
    ...disallowed.map((path) => `Disallow: ${path}`),
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}
