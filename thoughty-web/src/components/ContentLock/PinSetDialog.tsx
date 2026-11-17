import { useId, useRef, useState } from 'react';
import type { TranslationFunction } from '../../types';
import PinDialogFrame from './PinDialogFrame';
import PinField from './PinField';

interface PinSetDialogProps {
    readonly isDark: boolean;
    /** Saves a first PIN; resolves null once saved, or the message to show. */
    readonly onSave: (pin: string) => Promise<string | null>;
    readonly onClose: () => void;
    readonly t: TranslationFunction;
}

/** Locking needs a PIN to unlock with: this asks for the first one, twice. */
export default function PinSetDialog({ isDark, onSave, onClose, t }: PinSetDialogProps) {
    const [pin, setPin] = useState('');
    const [again, setAgain] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const fieldRef = useRef<HTMLInputElement>(null);
    const pinId = useId();
    const againId = useId();
    const hintId = useId();
    const errorId = useId();

    const submit = async () => {
        if (pin !== again) {
            setError(t('pinMismatch'));
            return;
        }
        setBusy(true);
        const message = await onSave(pin);
        setBusy(false);
        if (message) setError(message);
    };
    const edit = (setter: (value: string) => void) => (value: string) => {
        setter(value);
        setError('');
    };

    return (
        <PinDialogFrame
            title={t('pinSetDialogTitle')}
            description={t('pinSetDialogDescription')}
            isDark={isDark}
            submitLabel={t('pinSave')}
            cancelLabel={t('cancel')}
            busy={busy}
            canSubmit={pin.length === 4 && again.length === 4}
            initialFocusRef={fieldRef}
            onSubmit={() => void submit()}
            onClose={onClose}
        >
            <PinField ref={fieldRef} id={pinId} label={t('pinNew')} value={pin} onChange={edit(setPin)} isDark={isDark} describedBy={hintId} />
            <PinField id={againId} label={t('pinConfirm')} value={again} onChange={edit(setAgain)} isDark={isDark} invalid={Boolean(error)} describedBy={error ? errorId : undefined} />
            {error && <p id={errorId} role="alert" className={isDark ? 'text-red-300' : 'text-red-700'}>{error}</p>}
            <p id={hintId} className={isDark ? 'text-gray-400' : 'text-gray-600'}>{`${t('pinFormatHint')} ${t('pinLockNotEncryption')}`}</p>
        </PinDialogFrame>
    );
}
