import './PrivacyBlur.css';
import type { TranslationFunction } from '../../types';
import type { PrivacyBlurState } from './usePrivacyBlur';

interface PrivacyBlurButtonProps {
    readonly privacyBlur: PrivacyBlurState;
    readonly className: string;
    readonly t: TranslationFunction;
}

/** The toggle button of the privacy blur, with a status line that says when entry text is blurred or shown again. */
function PrivacyBlurButton({ privacyBlur, className, t }: PrivacyBlurButtonProps) {
    const { blurred, changed, toggle } = privacyBlur;
    let announcement = '';
    if (changed) {
        announcement = t(blurred ? 'privacyBlurOnAnnouncement' : 'privacyBlurOffAnnouncement');
    }

    return (
        <>
            <button
                type="button"
                className={className}
                aria-pressed={blurred}
                aria-keyshortcuts="Control+Shift+E Meta+Shift+E"
                title={t('privacyBlurHint')}
                onClick={toggle}
            >
                <span className={`codicon codicon-${blurred ? 'eye-closed' : 'eye'}`} aria-hidden="true" />
                <span className="sr-only">{t('privacyBlur')}</span>
            </button>
            <span role="status" className="sr-only">{announcement}</span>
        </>
    );
}

export default PrivacyBlurButton;
