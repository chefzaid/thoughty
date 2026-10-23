import { useState, type ComponentProps } from 'react';
import FocusMode from './FocusMode';

type FocusModeLauncherProps = Omit<ComponentProps<typeof FocusMode>, 'onClose'>;

/** The button that opens focus mode for a composer or editor, and the focus mode it opens. */
export default function FocusModeLauncher(focusModeProps: FocusModeLauncherProps) {
    const [open, setOpen] = useState(false);
    const label = focusModeProps.t('focusModeOpen');
    const buttonClassName = `flex items-center px-3 py-2 rounded-lg border transition-all ${focusModeProps.theme === 'light'
        ? 'border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100'
        : 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700'}`;

    return (
        <>
            <button
                type="button"
                data-focus-mode-trigger=""
                aria-haspopup="dialog"
                aria-label={label}
                title={label}
                className={buttonClassName}
                onClick={() => setOpen(true)}
            >
                <span className="codicon codicon-screen-full" aria-hidden="true" />
            </button>
            {open && <FocusMode {...focusModeProps} onClose={() => setOpen(false)} />}
        </>
    );
}
