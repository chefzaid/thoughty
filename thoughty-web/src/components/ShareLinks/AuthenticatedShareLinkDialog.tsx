import { useAuthenticatedService } from '../../hooks/useAuthenticatedService';
import { createShareLinksService } from '../../services/api';
import ShareLinkDialog, { type ShareLinkDialogProps } from './ShareLinkDialog';

/** The share link dialog with the signed-in session's service; rendered only while it is open. */
export default function AuthenticatedShareLinkDialog(props: Omit<ShareLinkDialogProps, 'service' | 'isOpen'>) {
    const service = useAuthenticatedService(createShareLinksService);
    return <ShareLinkDialog {...props} isOpen service={service} />;
}
