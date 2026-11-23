import { Entity } from 'typeorm';
import { OptInEmailSetting } from './opt-in-email-setting.base';

/**
 * A writer's year in review email: sent on January 1 of the writer's year about the year just ended,
 * at most once a year (`lastSentOn` is the local day it went out).
 */
@Entity('year_review_emails')
export class YearReviewEmail extends OptInEmailSetting {}
