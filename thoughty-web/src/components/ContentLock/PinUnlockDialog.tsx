import { useId, useRef, useState } from 'react';
import type { TranslationFunction } from '../../types';
import PinDialogFrame from './PinDialogFrame';
import PinField from './PinField';

interface PinUnlockDialogProps {
    readonly isDark: boolean;
    /** Unlocks with the PIN; resolves null once unlocked, or the message to show. */
    readonly onUnlock: (pin: string) => Promise<string | null>;
    readonly onClose: () => void;
    readonly t: TranslationFunction;
}

/** Asks for the PIN that unblurs locked diaries and entries. */
export default function PinUnlockDialog({ isDark, onUnlock, onClose, t }: PinUnlockDialogProps) {
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const fieldRef = useRef<HTMLInputElement>(null);
    const fieldId = useId();
    const hintId = useId();
    const errorId = useId();

    const submit = async () => {
        setBusy(true);
        const message = await onUnlock(pin);
        setBusy(false);
        if (message) {
            setError(message);
            setPin('');
            fieldRef.current?.focus();
        }
    };

    return (
        <PinDialogFrame
            title={t('pinDialogTitle')}
            description={t('pinDialogDescription')}
            isDark={isDark}
            submitLabel={t('pinUnblur')}
            cancelLabel={t('cancel')}
            busy={busy}
            canSubmit={pin.length === 4}
            initialFocusRef={fieldRef}
            onSubmit={() => void submit()}
            onClose={onClose}
        >
            <PinField
                ref={fieldRef}
                id={fieldId}
                label={t('pinDialogField')}
                value={pin}
                onChange={(value) => {
                    setPin(value);
                    setError('');
                }}
                isDark={isDark}
                describedBy={error ? `${errorId} ${hintId}` : hintId}
                invalid={Boolean(error)}
            />
            {error && <p id={errorId} role="alert" className={isDark ? 'text-red-300' : 'text-red-700'}>{error}</p>}
            <p id={hintId} className={isDark ? 'text-gray-400' : 'text-gray-600'}>{t('pinForgotHint')}</p>
        </PinDialogFrame>
    );
}
