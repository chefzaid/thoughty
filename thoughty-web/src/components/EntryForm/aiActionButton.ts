import { tintedTextClass } from '../../utils/tintedText';

const AI_ACTION_BASE =
    'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60';

const AI_ACTION_COLORS = {
    sky: 'border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20',
    amber: 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20',
    teal: 'border-teal-500/40 bg-teal-500/10 hover:bg-teal-500/20',
    violet: 'border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20',
} as const;

/** Shared look for the composer's actions: the AI ones (Auto Tag, Rephrase, Get Inspired) and Draw a card. */
export const aiActionButtonClass = (color: keyof typeof AI_ACTION_COLORS, theme?: 'light' | 'dark'): string =>
    `${AI_ACTION_BASE} ${AI_ACTION_COLORS[color]} ${tintedTextClass(color, theme)}`;
