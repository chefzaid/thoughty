import type { TranslationFunction } from '../../types';
import { QUICK_CAPTURE_KEYSHORTCUTS } from './quickCaptureShortcut';

interface QuickCaptureButtonProps {
    readonly isOpen: boolean;
    readonly onOpen: () => void;
    readonly className: string;
    readonly t: TranslationFunction;
}

/** The navigation's button that opens quick capture, the same box as its shortcut. */
function QuickCaptureButton({ isOpen, onOpen, className, t }: QuickCaptureButtonProps) {
    return (
        <button
            type="button"
            className={className}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-keyshortcuts={QUICK_CAPTURE_KEYSHORTCUTS}
            title={t('quickCaptureHint')}
            onClick={onOpen}
        >
            <span className="codicon codicon-zap" aria-hidden="true" />
            <span className="sr-only">{t('quickCapture')}</span>
        </button>
    );
}

export default QuickCaptureButton;
