import { describe, expect, it, vi } from 'vitest';

import { createComfortReadsService } from './comfortReadsService';

describe('comfortReadsService', () => {
  it('asks for the picks without the entry just written', async () => {
    const entries = [{ id: 11, date: '2025-06-14', index: 1, title: null, excerpt: 'A swim' }];
    const authFetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ entries }), { status: 200 }));

    await expect(createComfortReadsService(authFetch).pick(30)).resolves.toEqual({ data: { entries }, error: null });
    expect(authFetch).toHaveBeenCalledWith('/api/entries/comfort-reads?excludeId=30');
  });

  it('answers an error the card never shows', async () => {
    const authFetch = vi.fn().mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(createComfortReadsService(authFetch).pick(30)).resolves.toEqual({ data: null, error: 'comfortReadsLoadFailed' });
  });
});
