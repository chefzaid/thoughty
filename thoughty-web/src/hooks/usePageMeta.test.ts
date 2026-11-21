import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { usePageMeta } from './usePageMeta';

const description = () => document.head.querySelector<HTMLMetaElement>('meta[name="description"]');

describe('usePageMeta', () => {
  afterEach(() => {
    description()?.remove();
    document.title = '';
  });

  it('sets the title and description, then puts the page’s own back', () => {
    document.title = 'Thoughty';
    const meta = document.createElement('meta');
    meta.name = 'description';
    meta.content = 'A private journal that becomes your life story.';
    document.head.append(meta);

    const { rerender, unmount } = renderHook(({ title }) => usePageMeta(title, 'Every memoir question.'), {
      initialProps: { title: 'Memoir questions' },
    });
    expect(document.title).toBe('Memoir questions · Thoughty');
    expect(description()?.content).toBe('Every memoir question.');

    rerender({ title: 'Questions de mémoires' });
    expect(document.title).toBe('Questions de mémoires · Thoughty');

    unmount();
    expect(document.title).toBe('Thoughty');
    expect(description()?.content).toBe('A private journal that becomes your life story.');
  });

  it('adds a description where the document has none, and takes it away again', () => {
    const { unmount } = renderHook(() => usePageMeta('Journal templates', 'Free templates.'));
    expect(description()?.content).toBe('Free templates.');

    unmount();
    expect(description()).toBeNull();
  });
});
