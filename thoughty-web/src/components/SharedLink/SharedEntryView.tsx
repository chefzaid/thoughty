import EntryContentRenderer from '../EntryContentRenderer/EntryContentRenderer';
import { sharedAttachmentUrl, type SharedAttachment, type SharedEntry } from '../../services/api/shareLinksService';
import type { TranslationFunction } from '../../types';
import { isAudioAttachment, isImageAttachment, isVideoAttachment, EMPTY_CAPTIONS_TRACK_URL } from '../../utils/attachments';
import { describeMood } from '../../utils/entryMood';
import { formatTimeOfDay } from '../../utils/entryTime';
import { formatFileSize } from '../../utils/fileSize';
import { placedAttachmentIds } from '../../utils/inlineImages';
import type { Language } from '../../utils/translations';
import { formatEntryDay } from '../ShareLinks/shareLinkText';

interface SharedEntryViewProps {
    readonly token: string;
    readonly entry: SharedEntry;
    readonly theme: 'light' | 'dark';
    readonly language: Language;
    readonly t: TranslationFunction;
}

/** One of the entry's files that its text does not place, shown or played below it, or offered as a download. */
function SharedFile({ token, file, t }: Readonly<{ token: string; file: SharedAttachment; t: TranslationFunction }>) {
    const url = sharedAttachmentUrl(token, file.id);
    if (isImageAttachment(file.mimetype) && file.mimetype !== 'image/svg+xml') {
        return <img src={url} alt={file.name} loading="lazy" className="max-h-[28rem] max-w-full rounded-lg object-contain" />;
    }
    if (isVideoAttachment(file.mimetype)) {
        return (
            <video controls preload="metadata" className="max-h-[28rem] max-w-full rounded-lg" aria-label={file.name}
                poster={file.hasPoster ? sharedAttachmentUrl(token, file.id, 'poster') : undefined}>
                <source src={url} type={file.mimetype} />
                <track kind="captions" src={EMPTY_CAPTIONS_TRACK_URL} />
            </video>
        );
    }
    if (isAudioAttachment(file.mimetype)) {
        return (
            <audio controls preload="metadata" src={url} aria-label={file.name} className="w-full">
                <track kind="captions" src={EMPTY_CAPTIONS_TRACK_URL} />
            </audio>
        );
    }
    return (
        <a href={url} download={file.name} rel="noreferrer" className="underline underline-offset-2">
            {t('sharedDownloadFile', { name: file.name })} ({formatFileSize(file.size)})
        </a>
    );
}

/**
 * A shared entry as its reader sees it: its day, title, text (Markdown rendered as in the journal,
 * people and entry references as plain text), its own pictures in place, and its other files. Its
 * mood and tags show only when the writer chose so; nothing else of the journal is on the page.
 */
export default function SharedEntryView({ token, entry, theme, language, t }: SharedEntryViewProps) {
    const day = formatEntryDay(entry.date, language);
    const when = entry.timeOfDay ? `${day} · ${formatTimeOfDay(entry.timeOfDay, language)}` : day;
    const mood = describeMood(entry.mood, entry.feelings, t);
    const placed = entry.format === 'markdown' ? placedAttachmentIds(entry.content) : new Set<number>();
    const attachments = entry.attachments.map((file) => ({ id: file.id, original_filename: file.name, mimetype: file.mimetype, size: file.size }));
    const files = entry.attachments.filter((file) => !placed.has(file.id) || !isImageAttachment(file.mimetype));
    const mutedClass = theme === 'light' ? 'text-gray-600' : 'text-gray-300';

    return (
        <article className="space-y-5">
            <header className="space-y-1">
                <p className={`text-sm ${mutedClass}`}><time dateTime={entry.date}>{when}</time></p>
                <h1 className="text-2xl font-semibold">{entry.title?.trim() || day}</h1>
                {mood && <p className={`text-sm ${mutedClass}`}>{mood}</p>}
            </header>
            <div className={`break-words text-base leading-7 ${entry.format === 'markdown' ? '' : 'whitespace-pre-wrap'}`}>
                <EntryContentRenderer
                    content={entry.content}
                    format={entry.format}
                    attachments={attachments}
                    attachmentUrl={(id) => sharedAttachmentUrl(token, id)}
                    theme={theme}
                    t={t}
                />
            </div>
            {entry.tags.length > 0 && (
                <ul aria-label={t('sharedTags')} className="flex flex-wrap gap-2">
                    {entry.tags.map((tag) => (
                        <li key={tag} className={`rounded-full px-3 py-1 text-sm ${theme === 'light' ? 'bg-gray-200 text-gray-800' : 'bg-gray-700 text-gray-100'}`}>#{tag}</li>
                    ))}
                </ul>
            )}
            {files.length > 0 && (
                <section aria-label={t('sharedFiles')} className="space-y-3">
                    {files.map((file) => <SharedFile key={file.id} token={token} file={file} t={t} />)}
                </section>
            )}
        </article>
    );
}
