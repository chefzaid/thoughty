import { useId, useState, type FormEvent } from 'react';
import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createContentLockService, type ContentPinChange, type ContentPinProof, type ServiceResult } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { useContentLock, type ContentLockApi } from './contentLockContext';
import PinField from './PinField';

interface PinLockSectionProps {
    readonly isDark: boolean;
    /** Whether the account signs in with a password, which can reset a forgotten PIN. */
    readonly hasPassword: boolean;
    readonly t: TranslationFunction;
}

type Mode = 'idle' | 'change' | 'remove';

/**
 * The PIN of locked diaries and entries in the profile: set a first one, change it with the current PIN, reset
 * a forgotten one with the account password (and the emailed code when the API asks for it), or remove it,
 * which removes every lock. Locking itself happens on a diary or an entry.
 */
export default function PinLockSection(props: PinLockSectionProps) {
    const contentLock = useContentLock();
    return contentLock ? <PinLockForm {...props} contentLock={contentLock} /> : null;
}

function PinLockForm({ isDark, hasPassword, t, contentLock }: PinLockSectionProps & { readonly contentLock: ContentLockApi }) {
    const service = useAuthenticatedService(createContentLockService);
    const [mode, setMode] = useState<Mode>('idle');
    const [forgot, setForgot] = useState(false);
    const [currentPin, setCurrentPin] = useState('');
    const [password, setPassword] = useState('');
    const [pin, setPin] = useState('');
    const [again, setAgain] = useState('');
    const [challengeToken, setChallengeToken] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const ids = { current: useId(), password: useId(), pin: useId(), again: useId(), code: useId() };
    const { pinSet } = contentLock;

    const reset = (nextMode: Mode) => {
        setMode(nextMode);
        setForgot(false);
        setCurrentPin('');
        setPassword('');
        setPin('');
        setAgain('');
        setChallengeToken('');
        setCode('');
        setError('');
    };

    const proof = (): ContentPinProof => {
        if (!pinSet) return {};
        if (!forgot) return { currentPin };
        return { ...(hasPassword ? { password } : {}), ...(challengeToken ? { challengeToken, code } : {}) };
    };

    const finish = async (result: ServiceResult<ContentPinChange>, done: string) => {
        if (result.data && 'challengeToken' in result.data) {
            setChallengeToken(result.data.challengeToken);
            setMessage(t('pinEmailCodeSent'));
            return;
        }
        if (result.error) {
            setError(t(result.error));
            return;
        }
        reset('idle');
        setMessage(t(done));
        await contentLock.refresh();
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError('');
        setMessage('');
        if (mode !== 'remove' && pin !== again) {
            setError(t('pinMismatch'));
            return;
        }
        setBusy(true);
        const result = mode === 'remove' ? await service.removePin(proof()) : await service.setPin(pin, proof());
        setBusy(false);
        await finish(result, mode === 'remove' ? 'pinRemoved' : 'pinSaved');
    };

    const editing = !pinSet || mode !== 'idle';
    const needsCode = challengeToken !== '';
    const proofReady = !pinSet || (forgot ? (!hasPassword || password !== '') && (!needsCode || code.length === 6) : currentPin.length === 4);
    const pinReady = mode === 'remove' || (pin.length === 4 && again.length === 4);
    const fieldClass = `setting-input ${isDark ? 'dark' : 'light'}`;

    return (
        <div className="two-factor-section pin-lock-section">
            <div className="setting-row">
                <div className="setting-info">
                    <span className="setting-label">{t('pinLock')}</span>
                    <span className="setting-description">{t('pinLockDescription')}</span>
                    <span className="setting-description">{t('pinLockNotEncryption')}</span>
                </div>
                <span className={`two-factor-status ${pinSet ? 'enabled' : ''}`}>{t(pinSet ? 'pinLockPinSet' : 'pinLockNoPin')}</span>
            </div>

            {pinSet && mode === 'idle' && (
                <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-change-password" onClick={() => reset('change')}>{t('pinChange')}</button>
                    <button type="button" className="btn-two-factor-disable" onClick={() => reset('remove')}>{t('pinRemove')}</button>
                </div>
            )}

            {editing && (
                <form className="two-factor-form" onSubmit={(event) => void submit(event)} noValidate aria-label={t(pinSet ? (mode === 'remove' ? 'pinRemove' : 'pinChange') : 'pinSet')}>
                    {pinSet && !forgot && (
                        <PinField id={ids.current} label={t('pinCurrent')} value={currentPin} onChange={setCurrentPin} isDark={isDark} />
                    )}
                    {pinSet && forgot && hasPassword && (
                        <>
                            <label className="setting-label" htmlFor={ids.password}>{t('pinPassword')}</label>
                            <input id={ids.password} className={fieldClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
                        </>
                    )}
                    {needsCode && (
                        <>
                            <label className="setting-label" htmlFor={ids.code}>{t('pinEmailCode')}</label>
                            <input id={ids.code} className={fieldClass} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
                        </>
                    )}
                    {pinSet && (
                        <button type="button" className="btn-two-factor-disable self-start" onClick={() => { setForgot(!forgot); setChallengeToken(''); setError(''); }}>
                            {t(forgot ? 'pinUseCurrent' : 'pinForgot')}
                        </button>
                    )}
                    {mode !== 'remove' && (
                        <>
                            <PinField id={ids.pin} label={t('pinNew')} value={pin} onChange={setPin} isDark={isDark} />
                            <PinField id={ids.again} label={t('pinConfirm')} value={again} onChange={setAgain} isDark={isDark} />
                            <span className="setting-description">{t('pinFormatHint')}</span>
                        </>
                    )}
                    {mode === 'remove' && <span className="setting-description">{t('pinRemoveHint')}</span>}
                    {error && <p role="alert" className={isDark ? 'text-red-300' : 'text-red-700'}>{error}</p>}
                    <div className="flex flex-wrap gap-2">
                        <button type="submit" className="btn-change-password" disabled={busy || !proofReady || !pinReady}>
                            {t(mode === 'remove' ? 'pinRemove' : 'pinSave')}
                        </button>
                        {pinSet && <button type="button" className="btn-two-factor-disable" onClick={() => reset('idle')}>{t('cancel')}</button>}
                    </div>
                </form>
            )}
            <p role="status" className="setting-description">{message}</p>
        </div>
    );
}
