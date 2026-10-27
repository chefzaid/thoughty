/**
 * Text colors for tinted controls (a `-500` border over a faint `-500/10` background, `-500/20` on
 * hover): `-500` text falls below WCAG AA contrast there, so each tint uses the nearest shades that
 * reach 4.5:1 in both states, lighter in the dark theme and darker in the light theme.
 */
const TINTED_TEXT = {
    red: { dark: 'text-red-300', light: 'text-red-700' },
    amber: { dark: 'text-amber-400', light: 'text-amber-800' },
    yellow: { dark: 'text-yellow-400', light: 'text-yellow-800' },
    green: { dark: 'text-green-400', light: 'text-green-800' },
    emerald: { dark: 'text-emerald-400', light: 'text-emerald-800' },
    teal: { dark: 'text-teal-400', light: 'text-teal-800' },
    sky: { dark: 'text-sky-400', light: 'text-sky-700' },
    blue: { dark: 'text-blue-300', light: 'text-blue-700' },
    indigo: { dark: 'text-indigo-300', light: 'text-indigo-700' },
    violet: { dark: 'text-violet-300', light: 'text-violet-700' },
    gray: { dark: 'text-gray-400', light: 'text-gray-600' },
} as const;

export type Tint = keyof typeof TINTED_TEXT;

export function tintedTextClass(tint: Tint, theme?: 'light' | 'dark'): string {
    return TINTED_TEXT[tint][theme === 'light' ? 'light' : 'dark'];
}

/**
 * Secondary text (counts, timestamps, file sizes, empty states) at WCAG AA contrast on the card and
 * panel backgrounds of both themes, light gray-50/100 surfaces included: the gray tint's shades.
 */
export function mutedTextClass(isDark: boolean): string {
    return tintedTextClass('gray', isDark ? 'dark' : 'light');
}
