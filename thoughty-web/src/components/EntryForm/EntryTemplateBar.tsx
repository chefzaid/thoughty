import { useMemo, useState } from 'react';
import type { EntryTemplate } from '../../utils/entryTemplates';
import { tintedTextClass } from '../../utils/tintedText';
import TemplateNameDialog from './TemplateNameDialog';

interface EntryTemplateBarProps {
    readonly templates: EntryTemplate[];
    /** Fills the draft from the chosen template. */
    readonly onApply: (template: EntryTemplate) => void;
    /** Saves the current draft under a name; resolves whether it was saved. */
    readonly onSave?: (name: string) => Promise<boolean>;
    /** Resolves whether the template was deleted; it stays selected when it was not. */
    readonly onDelete?: (templateId: string) => Promise<boolean>;
    /** Whether the draft holds anything to save as a template. */
    readonly canSave: boolean;
    readonly theme?: 'light' | 'dark';
    readonly t: (key: string, params?: Record<string, string | number>) => string;
}

/** The composer's template row: pick a template, save the draft as one, or delete a custom one. */
export default function EntryTemplateBar({ templates, onApply, onSave, onDelete, canSave, theme, t }: EntryTemplateBarProps) {
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [isNaming, setIsNaming] = useState(false);
    const selectedTemplate = useMemo(
        () => templates.find((template) => template.id === selectedTemplateId),
        [templates, selectedTemplateId],
    );

    if (templates.length === 0 && !onSave) {
        return null;
    }

    const applyTemplate = (templateId: string): void => {
        setSelectedTemplateId(templateId);
        const template = templates.find((candidate) => candidate.id === templateId);
        if (template) {
            onApply(template);
        }
    };

    const saveDraft = async (name: string): Promise<boolean> => {
        const saved = (await onSave?.(name)) ?? false;
        if (saved) {
            setIsNaming(false);
        }
        return saved;
    };

    const deleteSelectedTemplate = async (): Promise<void> => {
        if (!selectedTemplate || selectedTemplate.builtIn || !onDelete) {
            return;
        }

        if (await onDelete(selectedTemplate.id)) {
            setSelectedTemplateId('');
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            {templates.length > 0 && (
                <select
                    value={selectedTemplateId}
                    onChange={(event) => applyTemplate(event.target.value)}
                    className={`min-w-0 flex-1 basis-56 border rounded-lg px-3 h-10 text-sm focus:ring-1 focus:ring-blue-500 outline-none ${theme === 'light'
                        ? 'bg-gray-50 border-gray-300 text-gray-900'
                        : 'bg-gray-900 border-gray-700 text-gray-100'
                        }`}
                    aria-label={t('entryTemplate')}
                    title={t('entryTemplate')}
                >
                    <option value="">{t('noEntryTemplate')}</option>
                    {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                            {template.name}
                        </option>
                    ))}
                </select>
            )}
            {onSave && (
                <button
                    type="button"
                    onClick={() => setIsNaming(true)}
                    disabled={!canSave}
                    aria-haspopup="dialog"
                    className={`inline-flex h-10 shrink-0 items-center gap-2 px-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-sm ${tintedTextClass('emerald', theme)} hover:bg-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed`}
                    title={t('saveEntryTemplate')}
                >
                    <span className="codicon codicon-save" aria-hidden="true" />
                    {t('saveEntryTemplate')}
                </button>
            )}
            {selectedTemplate && !selectedTemplate.builtIn && onDelete && (
                <button
                    type="button"
                    onClick={() => void deleteSelectedTemplate()}
                    className={`h-10 shrink-0 px-3 rounded-lg border border-red-500/40 bg-red-500/10 ${tintedTextClass('red', theme)} hover:bg-red-500/20 transition-all`}
                    title={t('deleteEntryTemplate')}
                >
                    {t('deleteEntryTemplate')}
                </button>
            )}
            {isNaming && (
                <TemplateNameDialog
                    theme={theme}
                    t={t}
                    onCancel={() => setIsNaming(false)}
                    onSave={saveDraft}
                />
            )}
        </div>
    );
}
