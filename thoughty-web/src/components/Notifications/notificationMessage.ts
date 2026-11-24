import type { AppNotification } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { formatCardDate } from '../ShareImageCard/shareCardLayout';

const MESSAGE_KEYS: Record<AppNotification['type'], string> = {
    comment: 'notificationComment',
    entryLike: 'notificationEntryLike',
    commentLike: 'notificationCommentLike',
    follow: 'notificationFollow',
    followRequest: 'notificationFollowRequest',
};

const ICONS: Record<AppNotification['type'], string> = {
    comment: 'comment',
    entryLike: 'heart',
    commentLike: 'heart',
    follow: 'person-add',
    followRequest: 'person-add',
};

/** What a notification says: who did what, on which entry (its title, or else its day). */
export function notificationMessage(notification: AppNotification, language: string, t: TranslationFunction): string {
    const { entry } = notification;
    let entryLabel = '';
    if (entry?.title) {
        entryLabel = t('notificationEntryTitle', { title: entry.title });
    } else if (entry) {
        const date = formatCardDate(entry.date, language);
        entryLabel = t(notification.type === 'commentLike' ? 'notificationTheEntry' : 'notificationYourEntry', { date });
    }
    return t(MESSAGE_KEYS[notification.type], { username: notification.actor.username, entry: entryLabel });
}

/** The icon beside a notification: a comment, a heart for a like, or a new follower or a request to follow. */
export function notificationIcon(notification: AppNotification): string {
    return ICONS[notification.type];
}
