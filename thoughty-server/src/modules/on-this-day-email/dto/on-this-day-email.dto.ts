import { EmailUnsubscribeQueryDto, OptInEmailSettingsDto, UpdateOptInEmailDto } from '@/modules/opt-in-email/dto';

/** The writer's "On this day" email setting. */
export class OnThisDayEmailSettingsDto extends OptInEmailSettingsDto {}

/** Turning the "On this day" email on or off and choosing its hour, time zone and diary. */
export class UpdateOnThisDayEmailDto extends UpdateOptInEmailDto {}

export class UnsubscribeOnThisDayEmailQueryDto extends EmailUnsubscribeQueryDto {}
