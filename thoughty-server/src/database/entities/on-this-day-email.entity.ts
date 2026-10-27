import { Entity } from 'typeorm';
import { OptInEmailSetting } from './opt-in-email-setting.base';

/** A writer's "On this day" email: sent on days with entries from earlier years, at most once a local day. */
@Entity('on_this_day_emails')
export class OnThisDayEmail extends OptInEmailSetting {}
