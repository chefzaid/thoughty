import { useState } from 'react';
import type { Config, Entry, TranslationFunction as TranslationFn } from '../../types';
import { resolveLanguage } from '../../utils/language';
import PrintEntriesDialog from '../PrintSheet/PrintEntriesDialog';
import { printableEntries } from '../PrintSheet/printableEntries';
import { formatEntryDay } from '../ShareLinks/shareLinkText';
import PrintIcon from '../PrintSheet/PrintIcon';

interface EntryDayHeadingProps {
    readonly label: string;
    /** The day's entries in the list, which can be printed together; none for a group that is not a day. */
    readonly dayEntries?: readonly Entry[];
    readonly config: Config;
    readonly t: TranslationFn;
}

/** A group's heading in the list; a day's heading also offers to print that day's entries. */
export default function EntryDayHeading({ label, dayEntries, config, t }: EntryDayHeadingProps) {
    const [printOpen, setPrintOpen] = useState(false);
    const isDark = config.theme !== 'light';
    const printable = printableEntries(dayEntries ?? []);
    const first = printable[0];

    return (
        <div className={`flex items-center justify-between gap-3 border-b pb-2 ${isDark ? 'border-gray-700' : 'border-gray-300'}`}>
            <h2 className={`text-xl font-bold ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>{label}</h2>
            {first && (
                <button
                    type="button"
                    onClick={() => setPrintOpen(true)}
                    className={`rounded-md p-1.5 transition-colors ${isDark ? 'text-gray-400 hover:bg-gray-700 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`}
                    title={t('printDay')}
                    aria-label={t('printDayOf', { date: formatEntryDay(first.date, resolveLanguage(config.language)) })}
                >
                    <PrintIcon />
                </button>
            )}
            {printOpen && (
                <PrintEntriesDialog what="day" entries={printable} config={config} onClose={() => setPrintOpen(false)} t={t} />
            )}
        </div>
    );
}
