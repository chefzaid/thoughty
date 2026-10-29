import { useEffect, useRef, useState } from 'react';

import ConfirmModal from '../ConfirmModal/ConfirmModal';
import type { LifeEra, LifeEraDraft } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { eraLabel, formatEraRange, LIFE_ERAS_SECTION_ID } from '../../utils/lifeEras';
import type { Language } from '../../utils/translations';
import LifeEraForm from './LifeEraForm';
import { useLifeEras } from './useLifeEras';
import './LifeErasSection.css';

interface LifeErasSectionProps {
  readonly isDark: boolean;
  readonly language: Language;
  readonly t: TranslationFunction;
}

/**
 * The profile's life eras: the list by start date, a form to add one, and editing and deleting in
 * place. Each change is saved at once, apart from the profile's own settings.
 */
function LifeErasSection({ isDark, language, t }: LifeErasSectionProps) {
  const { list, eras, create, update, remove } = useLifeEras();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LifeEra | null>(null);
  const [status, setStatus] = useState('');
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const limit = list.data?.limit ?? 0;
  const isFull = list.data !== undefined && eras.length >= limit;
  const theme = isDark ? 'dark' : 'light';

  // Opened from the journal's era filter (`/profile#life-eras`): bring the section into view
  useEffect(() => {
    if (globalThis.location.hash !== `#${LIFE_ERAS_SECTION_ID}`) return;
    sectionRef.current?.scrollIntoView?.({ block: 'start' });
    headingRef.current?.focus();
  }, []);

  const add = async (draft: LifeEraDraft): Promise<string | null> => {
    const result = await create(draft);
    if (!result.data) return t(result.error ?? 'lifeEraSaveFailed');
    setStatus(t('lifeEraAdded', { name: result.data.name }));
    return null;
  };

  const save = async (era: LifeEra, draft: LifeEraDraft): Promise<string | null> => {
    const result = await update(era.id, draft);
    if (!result.data) return t(result.error ?? 'lifeEraSaveFailed');
    setEditingId(null);
    setStatus(t('lifeEraUpdated', { name: result.data.name }));
    return null;
  };

  const confirmDelete = async () => {
    const era = pendingDelete;
    setPendingDelete(null);
    if (!era) return;
    const result = await remove(era.id);
    setStatus(result.data ? t('lifeEraDeleted', { name: era.name }) : t(result.error ?? 'lifeEraDeleteFailed'));
    headingRef.current?.focus();
  };

  return (
    <section ref={sectionRef} id={LIFE_ERAS_SECTION_ID} className={`profile-section life-eras ${theme}`} aria-labelledby={`${LIFE_ERAS_SECTION_ID}-title`}>
      <div className="section-header">
        <span className="codicon codicon-milestone section-icon" aria-hidden="true" />
        <h2 ref={headingRef} id={`${LIFE_ERAS_SECTION_ID}-title`} className="section-title" tabIndex={-1}>{t('lifeEras')}</h2>
        {list.data && <span className="life-eras-count">{t('lifeErasCount', { count: eras.length, limit })}</span>}
      </div>
      <div className="section-content">
        <p className="life-era-muted">{t('lifeErasIntro')}</p>
        <p className="sr-only" role="status" aria-live="polite">{status}</p>

        {list.isLoading && <p className="life-era-muted">{t('lifeErasLoading')}</p>}
        {list.isError && <p className="life-era-error" role="alert">{t('lifeErasLoadFailed')}</p>}
        {list.isSuccess && eras.length === 0 && <p className="life-era-muted">{t('lifeErasEmpty')}</p>}

        {eras.length > 0 && (
          <ul className="life-era-list">
            {eras.map((era) => (
              <li key={era.id} className={`life-era-item ${theme}`} style={era.color ? { borderLeftColor: era.color } : undefined}>
                {editingId === era.id ? (
                  <LifeEraForm era={era} onSubmit={(draft) => save(era, draft)} onCancel={() => setEditingId(null)} isDark={isDark} t={t} />
                ) : (
                  <div className="life-era-summary">
                    <div className="life-era-text">
                      <p className="life-era-name">{eraLabel(era)}</p>
                      <p className="life-era-dates">{formatEraRange(era, language, t)}</p>
                      {era.note && <p className="life-era-note">{era.note}</p>}
                    </div>
                    <div className="life-era-item-actions">
                      <button type="button" className="life-era-icon-button" onClick={() => setEditingId(era.id)} aria-label={t('lifeEraEdit', { name: era.name })} title={t('lifeEraEdit', { name: era.name })}>
                        <span className="codicon codicon-edit" aria-hidden="true" />
                      </button>
                      <button type="button" className="life-era-icon-button danger" onClick={() => setPendingDelete(era)} aria-label={t('lifeEraDelete', { name: era.name })} title={t('lifeEraDelete', { name: era.name })}>
                        <span className="codicon codicon-trash" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {isFull
          ? <p className="life-era-muted">{t('lifeErasLimitReached', { limit })}</p>
          : list.isSuccess && <LifeEraForm onSubmit={add} isDark={isDark} t={t} />}
      </div>

      <ConfirmModal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        title={t('lifeEraDeleteTitle')}
        message={t('lifeEraDeleteMessage', { name: pendingDelete?.name ?? '' })}
        theme={theme}
        t={t}
      />
    </section>
  );
}

export default LifeErasSection;
