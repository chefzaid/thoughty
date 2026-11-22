import type { TranslationFunction } from '../../types';
import type { Language } from '../../utils/translations';
import type { EntryChatEntry } from '../../services/api/entryChatService';
import { formatJournalDate } from '../../utils/entryDate';
import type { EntryChatTurn } from './useEntryChat';

interface EntryChatTurnsProps {
  readonly turns: readonly EntryChatTurn[];
  /** Opens a cited entry in the reader, among the entries its reply read. */
  readonly onOpenEntry: (readIds: readonly number[], entryId: number) => void;
  readonly language: Language;
  readonly isLight: boolean;
  readonly t: TranslationFunction;
}

/** The entries a reply cites, in the order it first cites them. */
function citedEntries(turn: EntryChatTurn): EntryChatEntry[] {
  const byRef = new Map((turn.entries ?? []).map((entry) => [entry.ref, entry]));
  return (turn.cited ?? []).flatMap((ref) => byRef.get(ref) ?? []);
}

/** A key for each message that stays put as messages are added below it. */
function turnKey(turns: readonly EntryChatTurn[], turn: EntryChatTurn, index: number): string {
  const same = turns.slice(0, index).filter((other) => other.role === turn.role && other.content === turn.content).length;
  return `${turn.role}:${turn.content}:${same}`;
}

/**
 * The conversation: the writer's messages on the right, the replies on the left, each reply followed by the
 * entries it cites as buttons ("[2] March 8, 2026 · Rain") that open the entry in the reader.
 */
export default function EntryChatTurns({ turns, onOpenEntry, language, isLight, t }: EntryChatTurnsProps) {
  const replyClass = isLight ? 'bg-gray-100 text-gray-800 rounded-bl-md' : 'bg-gray-700 text-gray-200 rounded-bl-md';
  const citationClass = isLight
    ? 'border-gray-300 text-gray-700 hover:bg-gray-100'
    : 'border-gray-600 text-gray-200 hover:bg-gray-700';

  return turns.map((turn, index) => {
    const cited = turn.role === 'assistant' ? citedEntries(turn) : [];
    return (
      <div key={turnKey(turns, turn, index)} className={`flex flex-col ${turn.role === 'user' ? 'items-end' : 'items-start'}`}>
        <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
          turn.role === 'user' ? 'bg-blue-600 text-white rounded-br-md' : replyClass
        }`}>
          <span className="privacy-text">{turn.content}</span>
        </div>
        {cited.length > 0 && (
          <div className="mt-2 max-w-[80%]">
            <p className={`text-xs font-medium ${isLight ? 'text-gray-600' : 'text-gray-400'}`}>{t('entryChatCited')}</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {cited.map((entry) => (
                <li key={entry.ref}>
                  <button
                    type="button"
                    onClick={() => onOpenEntry((turn.entries ?? []).map((read) => read.id), entry.id)}
                    title={t('entryChatOpenCited')}
                    className={`rounded-lg border px-2.5 py-1 text-xs transition-colors ${citationClass}`}
                  >
                    {`[${entry.ref}] ${formatJournalDate(entry.date, language)}${entry.title ? ` · ${entry.title}` : ''}`}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  });
}
