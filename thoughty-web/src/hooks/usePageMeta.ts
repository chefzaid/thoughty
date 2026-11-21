import { useEffect } from 'react';

/**
 * Gives a public page its own browser title and search description, so each one is indexed with
 * its own words, and puts back what was there when the page goes away.
 */
export function usePageMeta(title: string, description: string): void {
  useEffect(() => {
    const previousTitle = document.title;
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
    const added = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'description';
      document.head.append(meta);
    }
    const previousDescription = meta.content;
    document.title = `${title} · Thoughty`;
    meta.content = description;

    return () => {
      document.title = previousTitle;
      if (added) meta.remove();
      else meta.content = previousDescription;
    };
  }, [title, description]);
}
