import { useEffect, useRef, useState } from 'react';

import ConfirmModal from '../ConfirmModal/ConfirmModal';
import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import {
  createAccessTokensService,
  type CreatedPersonalAccessToken,
  type PersonalAccessToken,
  type PersonalAccessTokenDraft,
} from '../../services/api';
import AccessTokenForm from './AccessTokenForm';
import { SCOPE_LABELS } from './accessTokenLabels';
import { formatSessionDate } from './formatSessionDate';
import type { TranslationFunction } from './types';
import './AccessTokensSection.css';

interface AccessTokensSectionProps {
  readonly isDark: boolean;
  readonly t: TranslationFunction;
}

type CopyState = 'idle' | 'copied' | 'failed';

/** Where the public API answers, from this page's address. */
const publicApiUrl = () => `${globalThis.location.origin}/api/v1`;

/**
 * The writer's personal access tokens for the public API (Profile › Access tokens): the list with when each
 * was made, last used and expires, revoking one, and a form to make one, whose token is shown this once.
 */
function AccessTokensSection({ isDark, t }: AccessTokensSectionProps) {
  const service = useAuthenticatedService(createAccessTokensService);
  const [tokens, setTokens] = useState<PersonalAccessToken[] | null>(null);
  const [limit, setLimit] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [created, setCreated] = useState<CreatedPersonalAccessToken | null>(null);
  const [copy, setCopy] = useState<CopyState>('idle');
  const [pendingRevoke, setPendingRevoke] = useState<PersonalAccessToken | null>(null);
  const [revokeError, setRevokeError] = useState('');
  const [status, setStatus] = useState('');
  const tokenFieldRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const theme = isDark ? 'dark' : 'light';

  useEffect(() => {
    let active = true;
    void service.list().then(({ data }) => {
      if (!active) return;
      const loaded = data && Array.isArray(data.tokens) ? data : null;
      setLoadError(!loaded);
      if (!loaded) return;
      setTokens(loaded.tokens);
      setLimit(loaded.limit);
    });
    return () => {
      active = false;
    };
  }, [service]);

  useEffect(() => {
    if (created) tokenFieldRef.current?.select();
  }, [created]);

  const create = async (draft: PersonalAccessTokenDraft): Promise<string | null> => {
    const result = await service.create(draft);
    if (!result.data) return t(result.error ?? 'accessTokenCreateFailed');
    const { token: _secret, ...listed } = result.data;
    setTokens((current) => [listed, ...(current ?? [])]);
    setCopy('idle');
    setCreated(result.data);
    return null;
  };

  const copyToken = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  };

  const dismissCreated = () => {
    setCreated(null);
    headingRef.current?.focus();
  };

  const confirmRevoke = async () => {
    const token = pendingRevoke;
    setPendingRevoke(null);
    if (!token) return;
    setRevokeError('');
    const result = await service.revoke(token.id);
    if (!result.data) {
      setRevokeError(t(result.error ?? 'accessTokenRevokeFailed'));
      return;
    }
    setTokens((current) => current?.filter((candidate) => candidate.id !== token.id) ?? null);
    if (created?.id === token.id) setCreated(null);
    setStatus(t('accessTokenRevoked', { name: token.name }));
    headingRef.current?.focus();
  };

  const isFull = tokens !== null && tokens.length >= limit;

  return (
    <section className={`profile-section access-tokens ${theme}`} aria-labelledby="access-tokens-title">
      <div className="section-header">
        <span className="codicon codicon-key section-icon" aria-hidden="true" />
        <h2 ref={headingRef} id="access-tokens-title" className="section-title" tabIndex={-1}>{t('accessTokens')}</h2>
        {tokens && <span className="access-tokens-count">{t('accessTokensCount', { count: tokens.length, limit })}</span>}
      </div>
      <div className="section-content">
        <p className="access-tokens-muted">{t('accessTokensIntro')}</p>
        <p className="access-tokens-muted">{t('accessTokensUsage', { url: publicApiUrl() })}</p>
        <p className="sr-only" role="status" aria-live="polite">{status}</p>

        {tokens === null && !loadError && <p className="access-tokens-muted">{t('accessTokensLoading')}</p>}
        {loadError && <p className="access-token-error" role="alert">{t('accessTokensLoadFailed')}</p>}

        {created && (
          <div className="access-token-created" role="region" aria-labelledby="access-token-created-title">
            <p id="access-token-created-title" className="access-token-created-title">{t('accessTokenCreatedTitle')}</p>
            <p className="access-tokens-muted">{t('accessTokenCreatedNote')}</p>
            <div className="access-token-secret">
              <input
                ref={tokenFieldRef}
                type="text"
                readOnly
                className={`setting-input ${theme}`}
                value={created.token}
                aria-label={t('accessTokenValue')}
                onFocus={(event) => event.target.select()}
              />
              <button type="button" className="access-token-primary" onClick={() => void copyToken()}>
                <span className="codicon codicon-copy" aria-hidden="true" />
                {copy === 'copied' ? t('accessTokenCopied') : t('accessTokenCopy')}
              </button>
              <button type="button" className="access-token-secondary" onClick={dismissCreated}>{t('accessTokenDone')}</button>
            </div>
            {copy === 'failed' && <p className="access-token-error" role="alert">{t('accessTokenCopyFailed')}</p>}
          </div>
        )}

        {tokens?.length === 0 && <p className="access-tokens-muted">{t('accessTokensEmpty')}</p>}
        {tokens && tokens.length > 0 && (
          <ul className="access-token-list" aria-label={t('accessTokens')}>
            {tokens.map((token) => (
              <li key={token.id} className={`access-token-item ${theme}`}>
                <div className="access-token-text">
                  <p className="access-token-name">
                    {token.name} <code className="access-token-hint">{token.hint}…</code>
                  </p>
                  <p className="access-token-scopes-list">{token.scopes.map((scope) => t(SCOPE_LABELS[scope])).join(' · ')}</p>
                  <p className="access-tokens-muted">
                    {t('accessTokenCreatedOn', { date: formatSessionDate(token.createdAt) })}
                    {' · '}
                    {token.lastUsedAt ? t('accessTokenLastUsed', { date: formatSessionDate(token.lastUsedAt) }) : t('accessTokenNeverUsed')}
                    {' · '}
                    {token.expiresAt ? t('accessTokenExpiresOn', { date: formatSessionDate(token.expiresAt) }) : t('accessTokenNoExpiry')}
                  </p>
                </div>
                <button
                  type="button"
                  className="access-token-secondary danger"
                  aria-label={t('accessTokenRevokeLabel', { name: token.name })}
                  onClick={() => setPendingRevoke(token)}
                >
                  {t('accessTokenRevoke')}
                </button>
              </li>
            ))}
          </ul>
        )}
        {revokeError && <p className="access-token-error" role="alert">{revokeError}</p>}

        {isFull
          ? <p className="access-tokens-muted">{t('accessTokensLimitReached', { limit })}</p>
          : tokens !== null && <AccessTokenForm onSubmit={create} isDark={isDark} t={t} />}
      </div>

      <ConfirmModal
        isOpen={pendingRevoke !== null}
        onClose={() => setPendingRevoke(null)}
        onConfirm={() => void confirmRevoke()}
        title={t('accessTokenRevokeTitle')}
        message={t('accessTokenRevokeMessage', { name: pendingRevoke?.name ?? '' })}
        confirmLabel={t('accessTokenRevoke')}
        theme={theme}
        t={t}
      />
    </section>
  );
}

export default AccessTokensSection;
