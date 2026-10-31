import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import EntryContentRenderer from '../EntryContentRenderer/EntryContentRenderer';
import { MentionPeopleContext, NO_MENTION_PEOPLE } from '../People/PeopleContext';
import { formatEntryDay } from '../ShareLinks/shareLinkText';
import { extractDate } from '../EntriesList/EntriesList.utils';
import type { Attachment, Entry, TranslationFunction as TranslationFn } from '../../types';
import { resolveFontFamily, type FontFamilyPreference } from '../../types/config';
import { isImageAttachment, isVideoAttachment } from '../../utils/attachments';
import { describeMood } from '../../utils/entryMood';
import { formatTimeOfDay } from '../../utils/entryTime';
import { placedAttachmentIds } from '../../utils/inlineImages';
import type { Language } from '../../utils/translations';
import { printableEntries, type PrintOptions } from './printableEntries';
import { usePrintPictures } from './usePrintPictures';
import { whenSheetReady } from './whenSheetReady';
import './PrintSheet.css';

/** The entries by day, in the order they come. */
function byDay(entries: readonly Entry[]): { date: string; entries: Entry[] }[] {
    const days = new Map<string, Entry[]>();
    for (const entry of entries) {
        const date = extractDate(entry.date);
        days.set(date, [...(days.get(date) ?? []), entry]);
    }
    return [...days].map(([date, dayEntries]) => ({ date, entries: dayEntries }));
}

/** Marks the page while the sheet is there, so that printing shows the sheet and not the app. */
const ACTIVE_CLASS = 'print-sheet-active';

interface PrintedEntryProps {
    readonly entry: Entry;
    readonly options: PrintOptions;
    readonly language: Language;
    readonly urls: ReadonlyMap<string, string>;
    readonly t: TranslationFn;
}

/** One file under the text: a picture, a video's frame, or a line naming it. */
function PrintedAttachment({ attachment, urls, t }: Readonly<{ attachment: Attachment; urls: ReadonlyMap<string, string>; t: TranslationFn }>) {
    const name = attachment.original_filename;
    const picture = isImageAttachment(attachment.mimetype) ? urls.get(attachment.stored_filename) : undefined;
    const frame = isVideoAttachment(attachment.mimetype) && attachment.poster_filename ? urls.get(attachment.poster_filename) : undefined;

    if (picture) {
        return <figure className="print-picture"><img src={picture} alt={name} /></figure>;
    }
    if (frame) {
        return (
            <figure className="print-picture">
                <img src={frame} alt="" />
                <figcaption>{t('printVideoFrame', { name })}</figcaption>
            </figure>
        );
    }
    return <p className="print-attached">{t('printAttached', { name })}</p>;
}

function PrintedEntry({ entry, options, language, urls, t }: PrintedEntryProps) {
    const attachments = entry.attachments ?? [];
    const placed = entry.format === 'markdown' ? placedAttachmentIds(entry.content) : new Set<number>();
    // The text's own pictures show where it places them, once loaded; a picture that failed to load is missing there
    const inlineFiles = attachments.filter((attachment) => !isImageAttachment(attachment.mimetype) || urls.has(attachment.stored_filename));
    const below = attachments.filter((attachment) => !(placed.has(attachment.id) && isImageAttachment(attachment.mimetype)));
    const mood = options.mood ? describeMood(entry.mood, entry.feelings, t) : '';
    const fileUrlOf = (id: number) => urls.get(attachments.find((attachment) => attachment.id === id)?.stored_filename ?? '') ?? '';

    return (
        <article className="print-entry">
            {entry.time_of_day && (
                <p className="print-entry-time">
                    <time dateTime={entry.time_of_day}>{formatTimeOfDay(entry.time_of_day, language)}</time>
                </p>
            )}
            {entry.title && <h2 className="print-entry-title">{entry.title}</h2>}
            {mood && <p className="print-entry-meta">{t('moodLabel')}: {mood}</p>}
            <div className={`print-entry-text${entry.format === 'markdown' ? '' : ' whitespace-pre-wrap'}`}>
                <EntryContentRenderer
                    content={entry.content}
                    format={entry.format}
                    attachments={inlineFiles}
                    attachmentUrl={fileUrlOf}
                    eagerImages
                    theme="light"
                    t={t}
                />
            </div>
            {below.map((attachment) => <PrintedAttachment key={attachment.id} attachment={attachment} urls={urls} t={t} />)}
            {options.tags && entry.tags.length > 0 && (
                <p className="print-entry-meta">{t('tags')}: {entry.tags.map((tag) => `#${tag}`).join(' ')}</p>
            )}
        </article>
    );
}

interface PrintSheetProps {
    readonly entries: readonly Entry[];
    readonly options: PrintOptions;
    readonly language: Language;
    readonly fontFamily?: FontFamilyPreference;
    readonly t: TranslationFn;
    /** Called once, when every picture has loaded and the sheet can be printed. */
    readonly onReady: () => void;
}

/**
 * The entries as printed pages, set beside the app and shown only when printing: the day, then each
 * entry's time, title, text (as in the journal, with task lists as boxes and mentions as plain text)
 * and pictures, in the writer's font, black on white whatever the theme. Pictures load with the
 * session before `onReady`, so they are all on the paper.
 */
export default function PrintSheet({ entries, options, language, fontFamily, t, onReady }: PrintSheetProps) {
    const sheetRef = useRef<HTMLDivElement>(null);
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const printed = printableEntries(entries);
    const { urls, ready } = usePrintPictures(printed);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.add(ACTIVE_CLASS);
        return () => root.classList.remove(ACTIVE_CLASS);
    }, []);

    useEffect(() => {
        const sheet = sheetRef.current;
        if (!ready || !sheet) return undefined;
        return whenSheetReady(sheet, () => onReadyRef.current());
    }, [ready]);

    return createPortal(
        <div ref={sheetRef} className="print-sheet" lang={language} style={{ fontFamily: resolveFontFamily(fontFamily) }}>
            {ready && (
                <MentionPeopleContext.Provider value={NO_MENTION_PEOPLE}>
                    {byDay(printed).map((day) => (
                        <section key={day.date} className="print-day">
                            <h1 className="print-day-date">
                                <time dateTime={day.date}>{formatEntryDay(day.date, language)}</time>
                            </h1>
                            {day.entries.map((entry) => (
                                <PrintedEntry key={entry.id} entry={entry} options={options} language={language} urls={urls} t={t} />
                            ))}
                        </section>
                    ))}
                </MentionPeopleContext.Provider>
            )}
        </div>,
        document.body,
    );
}
