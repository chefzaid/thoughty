import { afterEach, describe, expect, it, vi } from 'vitest';
import { caretLineTop, centerCaretLine, typewriterScrollTop } from './typewriter';

describe('typewriter scrolling', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it('puts the caret line at the middle of the view, never above the top', () => {
        expect(typewriterScrollTop(900, 600)).toBe(600);
        expect(typewriterScrollTop(100, 600)).toBe(0);
    });

    it('measures the caret line on a copy of the text up to the caret, then removes the copy', () => {
        const area = document.createElement('textarea');
        area.value = 'first line\nsecond line';
        document.body.appendChild(area);
        area.setSelectionRange(5, 5);
        const offsetTop = vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(420);
        vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(30);

        expect(caretLineTop(area)).toBe(435);
        expect(offsetTop.mock.contexts.at(-1)).toHaveProperty('textContent', '​');
        expect(document.body.children).toHaveLength(1);
        area.remove();
    });

    const scrollingArea = (lineTop: number) => {
        const area = document.createElement('textarea');
        Object.defineProperty(area, 'clientHeight', { value: 400 });
        area.scrollTo = vi.fn() as unknown as typeof area.scrollTo;
        vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(lineTop);
        vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(0);
        return area;
    };

    it('scrolls smoothly unless the reader asked for reduced motion', () => {
        vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
        const area = scrollingArea(1000);
        centerCaretLine(area, true);
        expect(area.scrollTo).toHaveBeenCalledWith({ top: 800, behavior: 'smooth' });

        vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
        centerCaretLine(area, true);
        expect(area.scrollTo).toHaveBeenLastCalledWith({ top: 800, behavior: 'auto' });
    });

    it('leaves the view alone when the caret line is already in the middle', () => {
        const area = scrollingArea(200);
        centerCaretLine(area, true);
        expect(area.scrollTo).not.toHaveBeenCalled();
    });
});
