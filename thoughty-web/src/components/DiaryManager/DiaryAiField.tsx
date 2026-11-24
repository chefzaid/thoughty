import { useId } from 'react';
import './DiaryGoalField.css';
import type { DiaryAiMode } from '../../utils/diaryAi';

export type { DiaryAiMode };

const MODES: readonly DiaryAiMode[] = ['on', 'off', 'ask', 'local'];
const isMode = (value: string): value is DiaryAiMode => (MODES as readonly string[]).includes(value);

/**
 * Whether the AI features may read a diary: on, off so that none reads its entries, tags or files, asking each time,
 * or only the writer's own model, which this browser calls.
 */
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
                onChange={(event) => onChange(isMode(event.target.value) ? event.target.value : 'on')}
                title={t('diaryAiModeHint')}
            >
                <option value="on">{t('diaryAiModeOn')}</option>
                <option value="off">{t('diaryAiModeOff')}</option>
                <option value="ask">{t('diaryAiModeAsk')}</option>
                <option value="local">{t('diaryAiModeLocal')}</option>
            </select>
        </div>
    );
}
