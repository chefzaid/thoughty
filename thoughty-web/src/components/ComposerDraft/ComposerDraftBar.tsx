import { inlineImagesToAltText } from '../../utils/inlineImages';
import { mutedTextClass, tintedTextClass } from '../../utils/tintedText';
import type { ComposerDraftSync, ComposerDraftStatus } from './useComposerDraftSync';
import { formatDraftTime } from './formatDraftTime';

type Translate = (key: string, params?: Record<string, string | number>) => string;

const STATUS_KEYS: Record<Exclude<ComposerDraftStatus, 'idle'>, string> = {
  saving: 'composerDraftSaving',
  saved: 'composerDraftSaved',
  offline: 'composerDraftOffline',
  local: 'composerDraftLocal',
};

const EXCERPT_LENGTH = 120;

/** The start of the draft's title or text, on one line, so the writer knows which draft it is. */
function excerptOf(text: string, title: string | null, format: 'plain' | 'markdown'): string {
  const line = (title?.trim() || inlineImagesToAltText(text, format)).replaceAll(/\s+/g, ' ').trim();
  return line.length > EXCERPT_LENGTH ? `${line.slice(0, EXCERPT_LENGTH)}…` : line;
}

interface ComposerDraftBarProps {
  readonly draft: ComposerDraftSync;
  /** Whether the composer holds no text or title, which turns an offer to restore into a choice between two. */
  readonly composerEmpty: boolean;
  readonly language: string;
  readonly theme?: 'light' | 'dark';
  readonly t: Translate;
}

/** The choice to make about a draft saved on another device, above the composer. */
export function ComposerDraftOfferBar({ draft, composerEmpty, language, theme, t }: ComposerDraftBarProps) {
  const { offer } = draft;
  if (!offer) return null;
  const kind = offer.kind === 'restore' && !composerEmpty ? 'conflict' : offer.kind;
  const saved = offer.draft;
  const time = saved ? formatDraftTime(saved.updatedAt, language) : '';
  const excerpt = saved ? excerptOf(saved.text, saved.title, saved.format) : '';

  const actions = {
    restore: { message: t('composerDraftRestore', { time }), primary: [t('composerDraftContinue'), draft.takeSavedDraft], secondary: [t('composerDraftDiscard'), draft.discardSavedDraft] },
    conflict: { message: t('composerDraftConflict', { time }), primary: [t('composerDraftUseSaved'), draft.takeSavedDraft], secondary: [t('composerDraftKeepThis'), draft.keepThisDraft] },
    gone: { message: t('composerDraftGone'), primary: [t('composerDraftKeepWriting'), draft.keepThisDraft], secondary: [t('composerDraftClear'), draft.clearThisDraft] },
  } as const;
  const { message, primary, secondary } = actions[kind];
  const panelClass = theme === 'light' ? 'bg-blue-50 border-blue-200 text-gray-900' : 'bg-blue-500/10 border-blue-500/30 text-gray-100';
  const secondaryClass = theme === 'light'
    ? 'border-gray-300 text-gray-700 hover:bg-gray-100'
    : 'border-gray-600 text-gray-200 hover:bg-gray-700';

  return (
    <div role="group" aria-label={message} data-testid="composer-draft-offer" className={`flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm ${panelClass}`}>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{message}</p>
        {excerpt && <p className={`privacy-text truncate ${theme === 'light' ? 'text-gray-600' : 'text-gray-300'}`}>{excerpt}</p>}
      </div>
      <button type="button" onClick={primary[1]} className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700">
        {primary[0]}
      </button>
      <button type="button" onClick={secondary[1]} className={`rounded-lg border px-3 py-1.5 font-medium ${secondaryClass}`}>
        {secondary[0]}
      </button>
    </div>
  );
}

/** Where the draft is saved: on the server, on its way, or only on this device for now. */
export function ComposerDraftStatusText({ status, theme, t }: { readonly status: ComposerDraftStatus; readonly theme?: 'light' | 'dark'; readonly t: Translate }) {
  const warn = status === 'offline' || status === 'local';
  const colorClass = warn ? tintedTextClass('amber', theme) : mutedTextClass(theme !== 'light');
  return (
    <span role="status" aria-live="polite" data-testid="composer-draft-status" className={`text-xs ${colorClass}`}>
      {status === 'idle' ? '' : t(STATUS_KEYS[status])}
    </span>
  );
}
