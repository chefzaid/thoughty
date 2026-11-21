import { useId, useRef, useState, type FormEvent } from 'react';

import {
  ACCESS_TOKEN_LIFETIMES,
  ACCESS_TOKEN_SCOPES,
  type AccessTokenScope,
  type PersonalAccessTokenDraft,
} from '../../services/api';
import { browserTimeZone } from '../../utils/timeZone';
import { lifetimeLabel, SCOPE_LABELS } from './accessTokenLabels';
import type { TranslationFunction } from './types';

const NAME_MAX_LENGTH = 60;
const DEFAULT_LIFETIME = 90;

interface AccessTokenFormProps {
  /** Makes the token; resolves to an error message to show, or null once made. */
  readonly onSubmit: (draft: PersonalAccessTokenDraft) => Promise<string | null>;
  readonly isDark: boolean;
  readonly t: TranslationFunction;
}

type Problem = { field: 'name' | 'scopes' | null; message: string } | null;

/** A new token's name, what it may do and when it expires; the browser's time zone goes with it. */
function AccessTokenForm({ onSubmit, isDark, t }: AccessTokenFormProps) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<AccessTokenScope[]>(['entries:write']);
  const [lifetime, setLifetime] = useState<string>(String(DEFAULT_LIFETIME));
  const [problem, setProblem] = useState<Problem>(null);
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const firstScopeRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const field = (suffix: string) => `${id}-${suffix}`;
  const errorId = field('error');
  const theme = isDark ? 'dark' : 'light';

  const toggleScope = (scope: AccessTokenScope, checked: boolean) =>
    setScopes((current) => (checked ? [...current, scope] : current.filter((held) => held !== scope)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setProblem({ field: 'name', message: t('accessTokenNameRequired') });
      nameRef.current?.focus();
      return;
    }
    if (scopes.length === 0) {
      setProblem({ field: 'scopes', message: t('accessTokenNeedsScope') });
      firstScopeRef.current?.focus();
      return;
    }

    setSaving(true);
    setProblem(null);
    const error = await onSubmit({
      name: trimmedName,
      scopes: ACCESS_TOKEN_SCOPES.filter((scope) => scopes.includes(scope)),
      expiresInDays: lifetime === 'never' ? null : (Number(lifetime) as NonNullable<PersonalAccessTokenDraft['expiresInDays']>),
      timeZone: browserTimeZone(),
    });
    setSaving(false);
    if (error) {
      setProblem({ field: null, message: error });
      return;
    }
    setName('');
  };

  const invalid = (target: NonNullable<Problem>['field']) => (problem?.field === target
    ? { 'aria-invalid': true as const, 'aria-describedby': errorId }
    : {});

  return (
    <form className={`access-token-form ${theme}`} onSubmit={(event) => void submit(event)} noValidate>
      <fieldset disabled={saving}>
        <legend className="access-token-form-title">{t('accessTokenNewTitle')}</legend>
        <div className="access-token-form-grid">
          <label className="access-token-field" htmlFor={field('name')}>
            <span>{t('accessTokenName')}</span>
            <input
              ref={nameRef}
              id={field('name')}
              type="text"
              className={`setting-input ${theme}`}
              value={name}
              maxLength={NAME_MAX_LENGTH}
              placeholder={t('accessTokenNamePlaceholder')}
              onChange={(event) => setName(event.target.value)}
              required
              {...invalid('name')}
            />
          </label>
          <label className="access-token-field" htmlFor={field('lifetime')}>
            <span>{t('accessTokenLifetime')}</span>
            <select
              id={field('lifetime')}
              className={`setting-input ${theme}`}
              value={lifetime}
              onChange={(event) => setLifetime(event.target.value)}
            >
              {ACCESS_TOKEN_LIFETIMES.map((days) => (
                <option key={days ?? 'never'} value={days ?? 'never'}>{t(lifetimeLabel(days))}</option>
              ))}
            </select>
          </label>
          <fieldset className="access-token-scopes" {...invalid('scopes')}>
            <legend>{t('accessTokenScopes')}</legend>
            {ACCESS_TOKEN_SCOPES.map((scope, index) => (
              <label key={scope} className="access-token-check" htmlFor={field(scope)}>
                <input
                  ref={index === 0 ? firstScopeRef : undefined}
                  id={field(scope)}
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={(event) => toggleScope(scope, event.target.checked)}
                />
                {t(SCOPE_LABELS[scope])}
              </label>
            ))}
          </fieldset>
        </div>
        {problem && <p id={errorId} className="access-token-error" role="alert">{problem.message}</p>}
        <button type="submit" className="access-token-primary">
          <span className="codicon codicon-add" aria-hidden="true" />
          {saving ? t('accessTokenCreating') : t('accessTokenCreate')}
        </button>
      </fieldset>
    </form>
  );
}

export default AccessTokenForm;
