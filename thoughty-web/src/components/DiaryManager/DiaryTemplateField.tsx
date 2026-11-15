import { useId } from 'react';
import './DiaryGoalField.css';
import type { EntryTemplate } from '../../utils/entryTemplates';

/**
 * The template a diary's new entries start from: none, a built-in one or one of the writer's own. A
 * custom template deleted since stays chosen under "Deleted template" until another is picked, so the
 * writer sees why the composer no longer fills in.
 */
export default function DiaryTemplateField({
    templateId,
    templates,
    onChange,
    t,
}: Readonly<{
    templateId: string;
    templates: readonly EntryTemplate[];
    onChange: (templateId: string) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
}>) {
    const id = useId();
    const missing = templateId !== '' && !templates.some((template) => template.id === templateId);

    return (
        <div className="diary-goal-field">
            <label className="visibility-label" htmlFor={id}>{t('diaryDefaultTemplate')}</label>
            <select
                id={id}
                className="diary-goal-select"
                value={templateId}
                onChange={(event) => onChange(event.target.value)}
                title={t('diaryDefaultTemplateHint')}
            >
                <option value="">{t('diaryDefaultTemplateNone')}</option>
                {missing && <option value={templateId}>{t('diaryDefaultTemplateMissing')}</option>}
                {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                ))}
            </select>
        </div>
    );
}

