import { fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { whenSheetReady } from './whenSheetReady';

function picture(complete: boolean): HTMLImageElement {
    const image = document.createElement('img');
    Object.defineProperty(image, 'complete', { configurable: true, get: () => complete });
    return image;
}

describe('whenSheetReady', () => {
    const sheet = document.createElement('div');

    afterEach(() => {
        sheet.replaceChildren();
    });

    it('is ready at once when nothing is loading', () => {
        const onReady = vi.fn();
        sheet.append(picture(true));

        whenSheetReady(sheet, onReady);

        expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('waits for Markdown text to render, then for its pictures to load or fail', async () => {
        const onReady = vi.fn();
        const loading = document.createElement('span');
        loading.className = 'markdown-content';
        sheet.append(loading);

        whenSheetReady(sheet, onReady);
        expect(onReady).not.toHaveBeenCalled();

        // The renderer takes the place of the stand-in text, with two pictures still loading
        const rendered = document.createElement('span');
        rendered.className = 'markdown-content';
        rendered.dataset.markdown = '';
        let firstDone = false;
        let secondDone = false;
        const first = document.createElement('img');
        Object.defineProperty(first, 'complete', { get: () => firstDone });
        const second = document.createElement('img');
        Object.defineProperty(second, 'complete', { get: () => secondDone });
        rendered.append(first, second);
        loading.replaceWith(rendered);
        await Promise.resolve();
        expect(onReady).not.toHaveBeenCalled();

        firstDone = true;
        fireEvent.load(first);
        expect(onReady).not.toHaveBeenCalled();
        secondDone = true;
        fireEvent.error(second);
        expect(onReady).toHaveBeenCalledTimes(1);
    });

    it('stops watching when asked', async () => {
        const onReady = vi.fn();
        const loading = picture(false);
        sheet.append(loading);

        const stop = whenSheetReady(sheet, onReady);
        stop();
        loading.remove();
        sheet.append(picture(true));
        fireEvent.load(loading);

        await waitFor(() => expect(sheet.childElementCount).toBe(1));
        expect(onReady).not.toHaveBeenCalled();
    });
});
