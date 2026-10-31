import { useContext, useEffect, useState } from 'react';
import { isImageAttachment } from '../../utils/attachments';
import { attachmentIdOf } from '../../utils/inlineImages';
import AttachmentPreviewDialog from '../AttachmentPreview/AttachmentPreviewDialog';
import { useAuthenticatedAttachmentUrl } from '../AttachmentPreview/useAuthenticatedAttachmentUrl';
import { InlineImageContext, type InlineImageAttachment, type InlineImageScope } from './inlineImageContext';

type StoredAttachment = InlineImageAttachment & { readonly stored_filename: string };

/** True once the element comes near the viewport; at once where the browser cannot tell. */
function useNearViewport(element: HTMLElement | null): boolean {
    const [near, setNear] = useState(false);
    useEffect(() => {
        if (near || !element) return undefined;
        if (typeof IntersectionObserver === 'undefined') {
            setNear(true);
            return undefined;
        }
        const observer = new IntersectionObserver((records) => {
            if (records.some((record) => record.isIntersecting)) setNear(true);
        }, { rootMargin: '300px' });
        observer.observe(element);
        return () => observer.disconnect();
    }, [element, near]);
    return near;
}

function StoredInlineImage({ attachment, alt, scope }: Readonly<{ attachment: StoredAttachment; alt: string; scope: InlineImageScope }>) {
    const [frame, setFrame] = useState<HTMLButtonElement | null>(null);
    const [open, setOpen] = useState(false);
    const near = useNearViewport(frame);
    // Loaded with the session like the other previews, and only once the picture is about to show
    const url = useAuthenticatedAttachmentUrl(near ? attachment.stored_filename : null);
    const name = alt || attachment.original_filename;
    const { t } = scope;

    return (
        <>
            <button
                ref={setFrame}
                type="button"
                className="inline-image"
                aria-label={t(url ? 'inlineImageOpen' : 'inlineImageLoading', { name })}
                aria-haspopup="dialog"
                disabled={!url}
                onClick={(event) => {
                    event.stopPropagation();
                    setOpen(true);
                }}
            >
                {url
                    ? <img src={url} alt={alt} className="inline-image-picture" />
                    : <span className="inline-image-placeholder" aria-hidden="true" />}
            </button>
            <AttachmentPreviewDialog
                preview={open && url ? {
                    name: attachment.original_filename,
                    mimetype: attachment.mimetype,
                    sourceUrl: url,
                    size: attachment.size,
                    downloadUrl: url,
                } : null}
                isDark={scope.theme !== 'light'}
                onClose={() => setOpen(false)}
                t={t}
            />
        </>
    );
}

/**
 * An image of a Markdown entry. One of the entry's own pictures shows in the journal, loaded when it
 * comes into view, and opens the preview dialog; on a private share link's page it loads from the link. Elsewhere, and for any source that is not one of
 * the entry's pictures (web addresses are blocked by the page's security policy), the alt text stands in.
 */
function InlineImage({ src, alt }: Readonly<{ src?: string; alt?: string }>) {
    const scope = useContext(InlineImageContext);
    const text = (alt ?? '').trim();
    const id = attachmentIdOf(src);

    if (!scope || id === null) {
        return text ? <span className="inline-image-alt">{text}</span> : null;
    }

    const attachment = scope.attachments.find((candidate) => candidate.id === id);
    if (attachment && !isImageAttachment(attachment.mimetype)) {
        // A file that is not a picture stays listed below the entry; its name stands in here
        return <span className="inline-image-alt">{text || attachment.original_filename}</span>;
    }
    if (attachment && scope.fileUrlOf) {
        // A private share link's page, or the print view: the file is already at hand, with no session to fetch it with
        return <img src={scope.fileUrlOf(attachment.id)} alt={text} className="inline-image-picture" loading={scope.eager ? 'eager' : 'lazy'} />;
    }
    if (!attachment?.stored_filename) {
        return (
            <span className="inline-image-missing">
                <span className="codicon codicon-file-media" aria-hidden="true" />
                {text ? `${scope.t('inlineImageMissing')}: ${text}` : scope.t('inlineImageMissing')}
            </span>
        );
    }
    return <StoredInlineImage attachment={{ ...attachment, stored_filename: attachment.stored_filename }} alt={text} scope={scope} />;
}

export default InlineImage;
