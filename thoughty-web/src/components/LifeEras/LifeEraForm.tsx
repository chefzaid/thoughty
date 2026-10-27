import { useId, useRef, useState, type FormEvent } from 'react';

import type { LifeEra, LifeEraDraft } from '../../services/api';
import type { TranslationFunction } from '../../types';

const NAME_MAX_LENGTH = 50;
const EMOJI_MAX_LENGTH = 16;
const NOTE_MAX_LENGTH = 500;
const DEFAULT_COLOR = '#6366F1';

interface LifeEraFormProps {
  /** The era being edited; undefined to add one. */
  readonly era?: LifeEra;
  /** Saves the draft; resolves to an error message to show, or null once saved. */
  readonly onSubmit: (draft: LifeEraDraft) => Promise<string | null>;
  readonly onCancel?: () => void;
  readonly disabled?: boolean;
  readonly isDark: boolean;
  readonly t: TranslationFunction;
}

type Problem = { field: 'name' | 'start' | 'end' | null; message: string } | null;

/** The fields of a life era: a name and a start date, with an optional end (none while ongoing), emoji, colour and note. */
function LifeEraForm({ era, onSubmit, onCancel, disabled = false, isDark, t }: LifeEraFormProps) {
  const [name, setName] = useState(era?.name ?? '');
  const [startDate, setStartDate] = useState(era?.startDate ?? '');
  const [endDate, setEndDate] = useState(era?.endDate ?? '');
  const [emoji, setEmoji] = useState(era?.emoji ?? '');
  const [useColor, setUseColor] = useState(Boolean(era?.color));
  const [color, setColor] = useState(era?.color ?? DEFAULT_COLOR);
  const [note, setNote] = useState(era?.note ?? '');
  const [problem, setProblem] = useState<Problem>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const field = (suffix: string) => `${id}-${suffix}`;
  const theme = isDark ? 'dark' : 'light';
  const errorId = field('error');

  /** The first field the reader must fix, with what is wrong; null when the draft can be saved. */
  const check = (trimmedName: string): Problem => {
    if (!trimmedName) return { field: 'name', message: t('lifeEraNameRequired') };
    if (!startDate) return { field: 'start', message: t('lifeEraStartRequired') };
    if (endDate && endDate < startDate) return { field: 'end', message: t('lifeEraEndBeforeStart') };
    return null;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    const invalidDraft = check(trimmedName);
    if (invalidDraft) {
      setProblem(invalidDraft);
      const fieldRefs = { name: nameRef, start: startRef, end: endRef };
      if (invalidDraft.field) fieldRefs[invalidDraft.field].current?.focus();
      return;
    }

    setSaving(true);
    setProblem(null);
    const error = await onSubmit({
      name: trimmedName,
      startDate,
      endDate: endDate || null,
      emoji: emoji.trim() || null,
      color: useColor ? color.toUpperCase() : null,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      setProblem({ field: null, message: error });
      return;
    }
    if (!era) {
      setName('');
      setStartDate('');
      setEndDate('');
      setEmoji('');
      setUseColor(false);
      setNote('');
    }
  };

  const invalid = (target: NonNullable<Problem>['field']) => (problem?.field === target
    ? { 'aria-invalid': true as const, 'aria-describedby': errorId }
    : {});

  return (
    <form className={`life-era-form ${theme}`} onSubmit={(event) => void submit(event)} noValidate>
      <fieldset disabled={disabled || saving}>
        <legend className="life-era-form-title">
          {era ? t('lifeEraEditTitle', { name: era.name }) : t('lifeEraAddTitle')}
        </legend>
        <div className="life-era-form-grid">
          <label className="life-era-field life-era-field--wide" htmlFor={field('name')}>
            <span>{t('lifeEraName')}</span>
            <input
              ref={nameRef}
              id={field('name')}
              type="text"
              className={`setting-input ${theme}`}
              value={name}
              maxLength={NAME_MAX_LENGTH}
              placeholder={t('lifeEraNamePlaceholder')}
              onChange={(event) => setName(event.target.value)}
              required
              {...invalid('name')}
            />
          </label>
          <label className="life-era-field" htmlFor={field('emoji')}>
            <span>{t('lifeEraEmoji')}</span>
            <input
              id={field('emoji')}
              type="text"
              className={`setting-input ${theme}`}
              value={emoji}
              maxLength={EMOJI_MAX_LENGTH}
              placeholder="🎓"
              onChange={(event) => setEmoji(event.target.value)}
            />
          </label>
          <label className="life-era-field" htmlFor={field('start')}>
            <span>{t('lifeEraStart')}</span>
            <input
              ref={startRef}
              id={field('start')}
              type="date"
              className={`setting-input ${theme}`}
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              required
              {...invalid('start')}
            />
          </label>
          <div className="life-era-field">
            <label htmlFor={field('end')}>{t('lifeEraEnd')}</label>
            <input
              ref={endRef}
              id={field('end')}
              type="date"
              className={`setting-input ${theme}`}
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
              aria-describedby={problem?.field === 'end' ? `${field('end-help')} ${errorId}` : field('end-help')}
              aria-invalid={problem?.field === 'end' ? true : undefined}
            />
            <small id={field('end-help')} className="life-era-muted">{t('lifeEraEndHelp')}</small>
          </div>
          <div className="life-era-field life-era-color">
            <label className="life-era-check" htmlFor={field('use-color')}>
              <input id={field('use-color')} type="checkbox" checked={useColor} onChange={(event) => setUseColor(event.target.checked)} />
              {t('lifeEraUseColor')}
            </label>
            {useColor && (
              <input
                type="color"
                aria-label={t('lifeEraColor')}
                value={color}
                onChange={(event) => setColor(event.target.value)}
              />
            )}
          </div>
          <label className="life-era-field life-era-field--full" htmlFor={field('note')}>
            <span>{t('lifeEraNote')}</span>
            <textarea
              id={field('note')}
              className={`setting-input ${theme}`}
              value={note}
              rows={2}
              maxLength={NOTE_MAX_LENGTH}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </div>
        {problem && <p id={errorId} className="life-era-error" role="alert">{problem.message}</p>}
        <div className="life-era-actions">
          <button type="submit" className="life-era-primary">
            <span className={`codicon ${era ? 'codicon-save' : 'codicon-add'}`} aria-hidden="true" />
            {era ? t('lifeEraSaveChanges') : t('lifeEraAdd')}
          </button>
          {onCancel && (
            <button type="button" className="life-era-secondary" onClick={onCancel}>{t('cancel')}</button>
          )}
        </div>
      </fieldset>
    </form>
  );
}

export default LifeEraForm;
