import type { AppNotification } from '../../services/api';
import type { TranslationFunction } from '../../types';
import { resolveLanguage } from '../../utils/language';
import { pluralPhrase } from '../../utils/pluralPhrase';
import { formatCardDate } from '../ShareImageCard/shareCardLayout';

const MESSAGE_KEYS: Record<Exclude<AppNotification['type'], 'message'>, string> = {
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
    message: 'mail',
};

/**
 * What a notification says: who did what, on which entry (its title, or else its day); for messages, who wrote
 * and how many are unread, without the number in quiet mode.
 */
export function notificationMessage(notification: AppNotification, language: string, t: TranslationFunction, quiet = false): string {
    const { entry, conversation } = notification;
    const username = notification.actor.username;
    if (notification.type === 'message') {
        const count = conversation?.messageCount ?? 1;
        return quiet
            ? t('notificationMessageQuiet', { username })
            : pluralPhrase(t, 'notificationMessage', count, resolveLanguage(language), { username });
    }
    let entryLabel = '';
    if (entry?.title) {
        entryLabel = t('notificationEntryTitle', { title: entry.title });
    } else if (entry) {
        const date = formatCardDate(entry.date, language);
        entryLabel = t(notification.type === 'commentLike' ? 'notificationTheEntry' : 'notificationYourEntry', { date });
    }
    return t(MESSAGE_KEYS[notification.type], { username, entry: entryLabel });
}

/** The icon beside a notification: a comment, a heart for a like, a new follower or a request to follow, or a letter. */
export function notificationIcon(notification: AppNotification): string {
    return ICONS[notification.type];
}
