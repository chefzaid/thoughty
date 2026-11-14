import { afterEach, describe, expect, it, vi } from 'vitest';
import { prefersReducedMotion, scrollBehavior } from './motion';

describe('motion', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('scrolls smoothly when the system allows motion', () => {
        const matchMedia = vi.fn(() => ({ matches: false }));
        vi.stubGlobal('matchMedia', matchMedia);
        expect(prefersReducedMotion()).toBe(false);
        expect(scrollBehavior()).toBe('smooth');
        expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    });

    it('jumps when the system asks for less motion', () => {
        vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
        expect(prefersReducedMotion()).toBe(true);
        expect(scrollBehavior()).toBe('auto');
    });

    it('scrolls smoothly where the browser cannot tell', () => {
        vi.stubGlobal('matchMedia', undefined);
        expect(scrollBehavior()).toBe('smooth');
    });
});
