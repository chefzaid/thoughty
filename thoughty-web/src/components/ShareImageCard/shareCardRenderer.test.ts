import { describe, expect, it } from 'vitest';
import { createFakeContext, drawnText, type FakeContext } from './shareCard.test-utils';
import { CARD_THEMES } from './shareCardLayout';
import { drawShareCard, type ShareCardContent } from './shareCardRenderer';

const CONTENT: ShareCardContent = {
  text: 'The maple turned red.',
  title: 'Autumn light',
  date: 'October 12, 2026',
  theme: 'violet',
  size: 'portrait',
  showMark: true,
  markLabel: 'Thoughty',
};

function canvasWith(ctx: FakeContext | null) {
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'getContext', { value: () => ctx });
  return canvas;
}

describe('drawShareCard', () => {
  it('draws the card at twice its size with the gradient, quote mark, title, text, date and mark', () => {
    const { ctx, gradient } = createFakeContext();
    const canvas = canvasWith(ctx);
    const logo = document.createElement('img');

    const layout = drawShareCard(canvas, CONTENT, logo);

    expect([canvas.width, canvas.height]).toEqual([1080, 1350]);
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(gradient.addColorStop.mock.calls).toEqual([[0, '#3B82F6'], [0.5, '#7C3AED'], [1, '#9333EA']]);
    expect(drawnText(ctx)).toEqual(['“', 'Autumn light', 'The maple turned red.', 'October 12, 2026', 'Thoughty', '—']);
    expect(layout?.quote).toMatchObject({ fontSize: 36, truncated: false });
    expect(ctx.drawImage).toHaveBeenCalledWith(logo, expect.any(Number), 599, 28, 28);
  });

  it('centers a short quote in the free space', () => {
    const { ctx } = createFakeContext();
    drawShareCard(canvasWith(ctx), { ...CONTENT, title: undefined }, null);

    const [, quoteY] = ctx.fillText.mock.calls.find(([text]) => text === CONTENT.text)!.slice(1) as number[];
    expect(quoteY).toBeGreaterThan(250);
  });

  it('leaves out the title, the logo and the mark when they are not wanted', () => {
    const { ctx, gradient } = createFakeContext();
    const layout = drawShareCard(canvasWith(ctx), { ...CONTENT, title: '  ', theme: 'light', size: 'square', showMark: false }, null);

    expect(layout?.title).toEqual([]);
    expect(drawnText(ctx)).toEqual(['“', CONTENT.text, CONTENT.date]);
    expect(gradient.addColorStop.mock.calls).toEqual(CARD_THEMES.light.background.map((color, index) => [index, color]));
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('writes the mark without the logo while it has not loaded', () => {
    const { ctx } = createFakeContext();
    drawShareCard(canvasWith(ctx), CONTENT, null);

    expect(drawnText(ctx).slice(-2)).toEqual(['Thoughty', '—']);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('shrinks and then cuts a long text so it stays above the footer', () => {
    const { ctx } = createFakeContext();
    const layout = drawShareCard(canvasWith(ctx), { ...CONTENT, size: 'square', text: 'many words '.repeat(200) }, null);

    expect(layout?.quote).toMatchObject({ fontSize: 18, truncated: true });
    expect(layout?.quote.lines.at(-1)).toMatch(/…$/);
  });

  it('draws nothing when the browser has no 2D canvas', () => {
    expect(drawShareCard(canvasWith(null), CONTENT, null)).toBeNull();
  });
});
