import { Entity } from 'typeorm';
import { OptInEmailSetting } from './opt-in-email-setting.base';

/**
 * A writer's writing reminder email: a nudge at the chosen local hour on each day they have not written
 * yet, at most once a day (`lastSentOn` is the local day it went out). The diary is the one it watches
 * and opens on, null for all of them.
 */
@Entity('writing_reminder_emails')
export class WritingReminderEmail extends OptInEmailSetting {}
