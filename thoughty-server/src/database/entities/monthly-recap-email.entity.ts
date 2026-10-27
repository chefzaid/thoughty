import { Entity } from 'typeorm';
import { OptInEmailSetting } from './opt-in-email-setting.base';

/**
 * A writer's monthly recap email: sent on the 1st of each local month about the month just ended,
 * at most once a month (`lastSentOn` is the local day it went out).
 */
@Entity('monthly_recap_emails')
export class MonthlyRecapEmail extends OptInEmailSetting {}
