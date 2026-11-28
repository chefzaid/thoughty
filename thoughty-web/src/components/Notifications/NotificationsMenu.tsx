import { useCallback, useId, useRef, useState, type FocusEvent } from 'react';
import { useNavigate } from 'react-router-dom';

import type { AppNotification } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { resolveLanguage } from '../../utils/language';
import { pluralPhrase } from '../../utils/pluralPhrase';
import useDismissibleMenu, { type MenuDismissReason } from '../EntriesList/useDismissibleMenu';
import { useFeatureFlag } from '../FeatureFlags/featureFlags';
import { useQuietMode } from '../QuietMode/quietMode';
import { notificationIcon, notificationMessage } from './notificationMessage';
import { useNotifications } from './useNotifications';
import './NotificationsMenu.css';

interface NotificationsMenuProps {
    readonly language?: string;
    readonly t: TranslationFunction;
}

/**
 * The bell beside quick capture: how many notifications are new (only that there are some, in quiet mode), and a
 * panel listing the comments and likes on your public entries, the likes on your comments, your new followers and
 * the conversations with unread messages. Opening it marks them read; one about an entry opens that entry in the
 * feed, one about messages opens the conversation. Not shown while public sharing is off.
 */
function NotificationsMenu(props: NotificationsMenuProps) {
    return useFeatureFlag('publicSharing') ? <NotificationsMenuInner {...props} /> : null;
}

function NotificationsMenuInner({ language, t }: NotificationsMenuProps) {
    const uiLanguage = resolveLanguage(language);
    const quiet = useQuietMode();
    const navigate = useNavigate();
    const { unreadCount, notifications, loading, error, load } = useNotifications();
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const headingId = useId();
    const wrapperRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const timeFormat = new Intl.DateTimeFormat(uiLanguage, { dateStyle: 'medium', timeStyle: 'short' });

    const close = useCallback((reason: MenuDismissReason) => {
        setOpen(false);
        if (reason === 'escape') buttonRef.current?.focus();
    }, []);
    useDismissibleMenu(open, wrapperRef, close);

    const toggle = () => {
        if (!open) void load();
        setOpen(!open);
    };
    const closeWhenFocusLeaves = (event: FocusEvent<HTMLDivElement>) => {
        const next = event.relatedTarget;
        if (open && next instanceof Node && !wrapperRef.current?.contains(next)) setOpen(false);
    };
    const openTarget = (path: string) => {
        setOpen(false);
        navigate(path);
    };

    let buttonLabel = t('notifications');
    if (unreadCount > 0) {
        buttonLabel = quiet ? t('notificationsNewQuiet') : pluralPhrase(t, 'notificationsNew', unreadCount, uiLanguage);
    }

    return (
        <div className="nav-notifications" ref={wrapperRef} onBlur={closeWhenFocusLeaves}>
            <button
                type="button"
                ref={buttonRef}
                className="nav-icon-btn nav-notifications-btn"
                aria-expanded={open}
                aria-controls={panelId}
                title={buttonLabel}
                onClick={toggle}
            >
                <span className="codicon codicon-bell" aria-hidden="true" />
                <span className="sr-only">{buttonLabel}</span>
                {unreadCount > 0 && (
                    <span className={`nav-notifications-badge${quiet ? ' dot' : ''}`} aria-hidden="true">
                        {quiet ? '' : Math.min(unreadCount, 99).toLocaleString(uiLanguage) + (unreadCount > 99 ? '+' : '')}
                    </span>
                )}
            </button>
            <section id={panelId} className="nav-notifications-panel" aria-labelledby={headingId} hidden={!open}>
                <h2 id={headingId}>{t('notifications')}</h2>
                {loading && <p className="nav-notifications-note">{t('loading')}</p>}
                {!loading && error && (
                    <div className="nav-notifications-note error" role="alert">
                        <p>{t(error)}</p>
                        <button type="button" onClick={() => void load()}>{t('tryAgain')}</button>
                    </div>
                )}
                {!loading && !error && notifications?.length === 0 && (
                    <p className="nav-notifications-note">{t('notificationsEmpty')}</p>
                )}
                {!loading && !error && notifications && notifications.length > 0 && (
                    <ul className="nav-notifications-list">
                        {notifications.map((notification) => (
                            <NotificationItem
                                key={notification.id}
                                notification={notification}
                                message={notificationMessage(notification, uiLanguage, t, quiet)}
                                time={timeFormat.format(new Date(notification.createdAt))}
                                onOpen={openTarget}
                                t={t}
                            />
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

interface NotificationItemProps {
    readonly notification: AppNotification;
    readonly message: string;
    readonly time: string;
    readonly onOpen: (path: string) => void;
    readonly t: TranslationFunction;
}

/** Where a notification leads: its entry in the feed, or the conversation; nowhere for a new follower. */
function notificationTarget({ entry, conversation }: AppNotification): string | null {
    if (entry) return `/feed?entry=${entry.id}`;
    if (conversation) return `/messages?conversation=${conversation.id}`;
    return null;
}

/** One notification: a button to its entry in the feed or its conversation, or plain text for a new follower. */
function NotificationItem({ notification, message, time, onOpen, t }: NotificationItemProps) {
    const { comment, conversation, unread } = notification;
    const target = notificationTarget(notification);
    const body = (
        <>
            <span className={`codicon codicon-${notificationIcon(notification)}`} aria-hidden="true" />
            <span className="nav-notification-text">
                <span className="nav-notification-message">{message}</span>
                {comment && <span className="nav-notification-excerpt">{comment.excerpt}</span>}
                {conversation && <span className="nav-notification-excerpt privacy-text">{conversation.excerpt}</span>}
                <span className="nav-notification-time">
                    {time}
                    {unread && <span className="nav-notification-new"> · {t('notificationNew')}</span>}
                </span>
            </span>
        </>
    );
    return (
        <li className={unread ? 'unread' : undefined}>
            {target ? (
                <button type="button" className="nav-notification" onClick={() => onOpen(target)}>{body}</button>
            ) : (
                <div className="nav-notification">{body}</div>
            )}
        </li>
    );
}

export default NotificationsMenu;
