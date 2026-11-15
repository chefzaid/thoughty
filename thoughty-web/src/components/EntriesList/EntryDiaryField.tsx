import type { Dispatch, SetStateAction } from 'react';
import type { Diary, TranslationFunction as TranslationFn } from '../../types';
import { entryDiaryId } from './entryDiary';

interface EntryDiaryFieldProps {
    readonly id: string;
    readonly diaries: readonly Diary[];
    /** The diary chosen in the editor; `null` (an entry saved before it had a diary) shows the default diary. */
    readonly value: number | null;
    readonly onChange: Dispatch<SetStateAction<number | null>>;
    readonly selectClass: string;
    readonly t: TranslationFn;
}

/** The editor's choice of diary for an entry, shown once the writer has two diaries or more. */
export default function EntryDiaryField({ id, diaries, value, onChange, selectClass, t }: EntryDiaryFieldProps) {
    if (diaries.length < 2) {
        return null;
    }

    const selected = entryDiaryId({ diary_id: value }, diaries) ?? '';
    return (
        <div>
            <label htmlFor={id} className="sr-only">{t('entryDiaryLabel')}</label>
            <select
                id={id}
                value={selected}
                onChange={(event) => onChange(Number(event.target.value))}
                title={t('entryDiaryLabel')}
                className={selectClass}
            >
                {diaries.map((diary) => (
                    <option key={diary.id} value={diary.id}>{`${diary.icon} ${diary.name}`.trim()}</option>
                ))}
            </select>
        </div>
    );
}
