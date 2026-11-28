import type { TranslationFunction } from '../../types';
import { sectionLabel } from './readingNoteEntry';
import type { ReadingNote } from './readingNotesStorage';

/** The notes taken on the open book, in the book's order, each with where it is and its actions. */
export function ReadingNotesList({
  notes,
  labelledBy,
  onGoTo,
  onEdit,
  onRemove,
  t,
}: Readonly<{
  notes: readonly ReadingNote[];
  labelledBy: string;
  onGoTo: (note: ReadingNote) => void;
  onEdit: (note: ReadingNote) => void;
  onRemove: (note: ReadingNote) => void;
  t: TranslationFunction;
}>) {
  if (notes.length === 0) {
    return <p className="reading-notes-list__empty">{t('readingNotesNone')}</p>;
  }
  const ordered = [...notes].sort((left, right) => left.section.number - right.section.number);
  return (
    <ul className="reading-notes-list" aria-labelledby={labelledBy}>
      {ordered.map((note) => {
        const location = sectionLabel(note.section, t);
        return (
          <li key={note.id} className="reading-notes-list__item">
            <button type="button" className="reading-notes-list__location" onClick={() => onGoTo(note)}>
              {location}
            </button>
            {note.quote && <blockquote className="reading-notes-list__quote privacy-text">{note.quote}</blockquote>}
            {note.note && <p className="reading-notes-list__note privacy-text">{note.note}</p>}
            <div className="reading-notes-list__actions">
              <button type="button" className="io-btn secondary" onClick={() => onEdit(note)} aria-label={t('readingNotesEditOn', { location })}>
                {t('readingNotesEdit')}
              </button>
              <button type="button" className="io-btn secondary" onClick={() => onRemove(note)} aria-label={t('readingNotesRemoveOn', { location })}>
                {t('readingNotesRemove')}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
