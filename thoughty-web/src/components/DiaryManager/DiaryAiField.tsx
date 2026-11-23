import { useId } from 'react';
import './DiaryGoalField.css';
import type { Diary } from '../../types';

export type DiaryAiMode = Diary['aiMode'];

/** Whether the AI features may read a diary: on, or off so that none reads its entries, tags or files. */
export default function DiaryAiField({
    aiMode,
    onChange,
    t,
}: Readonly<{
    aiMode: DiaryAiMode;
    onChange: (aiMode: DiaryAiMode) => void;
    t: (key: string) => string;
}>) {
    const id = useId();

    return (
        <div className="diary-goal-field">
            <label className="visibility-label" htmlFor={id}>{t('diaryAiMode')}</label>
            <select
                id={id}
                className="diary-goal-select"
                value={aiMode}
                onChange={(event) => onChange(event.target.value === 'off' ? 'off' : 'on')}
                title={t('diaryAiModeHint')}
            >
                <option value="on">{t('diaryAiModeOn')}</option>
                <option value="off">{t('diaryAiModeOff')}</option>
            </select>
        </div>
    );
}
