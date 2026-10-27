import { vi } from 'vitest';

/**
 * A stand-in for a canvas 2D context (jsdom has none): it records what is drawn, and measures
 * each character at half the current font size.
 */
export function createFakeContext() {
  const gradient = { addColorStop: vi.fn() };
  const ctx = {
    font: '10px sans-serif',
    fillStyle: '' as string | object,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    setTransform: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    measureText: vi.fn((text: string) => {
      const size = Number(/(\d+)px/.exec(ctx.font)?.[1] ?? 10);
      return { width: Array.from(text).length * size * 0.5 };
    }),
  };
  return { ctx, gradient };
}

export type FakeContext = ReturnType<typeof createFakeContext>['ctx'];

/** The text drawn on the fake context, in drawing order. */
export function drawnText(ctx: FakeContext): string[] {
  return ctx.fillText.mock.calls.map(([text]) => text as string);
}
