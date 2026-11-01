import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The privacy blur's stylesheet, without comments, split at its media queries. */
const blocks = readFileSync(join(import.meta.dirname, 'PrivacyBlur.css'), 'utf8')
    .replaceAll(/\/\*[\s\S]*?\*\//g, '')
    .split('@media')
    .slice(1);

describe('privacy blur styles', () => {
    it('blurs on screens only, so printing never blurs', () => {
        const blurring = blocks.filter((block) => block.includes('blur(') || block.includes('text-shadow'));
        expect(blurring).toHaveLength(1);
        expect(blurring[0].trimStart()).toMatch(/^screen\s*\{/);
    });

    it('only animates when the system allows motion', () => {
        const animating = blocks.filter((block) => block.includes('transition'));
        expect(animating).toHaveLength(1);
        expect(animating[0]).toContain('prefers-reduced-motion: no-preference');
    });
});
