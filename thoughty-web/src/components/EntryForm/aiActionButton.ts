const AI_ACTION_BASE =
    'inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60';

const AI_ACTION_COLORS = {
    sky: 'border-sky-500/40 bg-sky-500/10 text-sky-500 hover:bg-sky-500/20',
    amber: 'border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20',
    teal: 'border-teal-500/40 bg-teal-500/10 text-teal-500 hover:bg-teal-500/20',
} as const;

/** Shared look for the composer's AI actions (Auto Tag, Rephrase, Get Inspired). */
export const aiActionButtonClass = (color: keyof typeof AI_ACTION_COLORS): string =>
    `${AI_ACTION_BASE} ${AI_ACTION_COLORS[color]}`;
