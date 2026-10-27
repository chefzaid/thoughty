import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import AttachmentPreviewContent from './AttachmentPreviewContent';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { formatAttachmentSize, getAttachmentKindLabel } from '../../utils/attachments';

interface AttachmentPreviewDialogProps {
  readonly preview: {
    name: string;
    mimetype: string;
    sourceUrl: string;
    size: number;
    downloadUrl?: string;
  } | null;
  readonly isDark: boolean;
  readonly onClose: () => void;
  readonly t: (key: string) => string;
}

/**
 * Shows an attachment in a modal dialog: focus starts on Close, Tab stays inside, Escape closes
 * it from anywhere, and focus goes back to the preview button that opened it.
 */
function AttachmentPreviewDialog({ preview, isDark, onClose, t }: AttachmentPreviewDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const detailsId = useId();

  useDialogFocus({ isOpen: preview !== null, dialogRef, initialFocusRef: closeButtonRef, onClose });

  if (!preview) {
    return null;
  }

  // Portaled to the body: the entry form's blurred panel would otherwise be the fixed overlay's frame.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${t('previewAttachment')} ${preview.name}`}
        aria-describedby={detailsId}
        className={`relative flex w-[min(92vw,1100px)] max-w-[1100px] flex-col gap-4 rounded-2xl border p-5 shadow-2xl ${isDark ? 'border-gray-700 bg-gray-900 text-gray-100' : 'border-gray-200 bg-white text-gray-900'}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{preview.name}</p>
            <p id={detailsId} className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{getAttachmentKindLabel(preview.mimetype, t)} · {formatAttachmentSize(preview.size)}</p>
          </div>
          <div className="flex items-center gap-3">
            {preview.downloadUrl && (
              <a
                href={preview.downloadUrl}
                download={preview.name}
                className={`${isDark ? 'text-blue-300 hover:text-blue-200' : 'text-blue-700 hover:text-blue-800'}`}
              >
                {t('downloadAttachment')}
              </a>
            )}
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              className={`rounded-full px-3 py-1 text-sm ${isDark ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {t('close')}
            </button>
          </div>
        </div>
        <div className={`flex min-h-[240px] items-center justify-center overflow-hidden rounded-xl border p-3 ${isDark ? 'border-gray-700 bg-black/30' : 'border-gray-200 bg-gray-50'}`}>
          <AttachmentPreviewContent
            name={preview.name}
            mimetype={preview.mimetype}
            sourceUrl={preview.sourceUrl}
            variant="modal"
            t={t}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default AttachmentPreviewDialog;
