export const HEX_COLOR_PATTERN = /^#[0-9A-F]{6}$/;

export function normalizeHexColor(color?: string | null): string | null {
    if (typeof color !== 'string') {
        return null;
    }

    const normalized = color.trim().toUpperCase();
    return HEX_COLOR_PATTERN.test(normalized) ? normalized : null;
}

export function getColorSeed(value?: string | number | null): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Math.abs(Math.trunc(value));
    }

    if (typeof value !== 'string') {
        return 0;
    }

    let hash = 0;
    for (const character of value) {
        const codePoint = character.codePointAt(0) ?? 0;
        hash = Math.trunc((hash * 31) + codePoint);
    }

    return Math.abs(hash);
}