/** When an opt-in email comes round, and which period of the writer's calendar one email covers. */
export interface OptInEmailSchedule {
  /** The local hour the email arrives at until the writer picks another. */
  readonly defaultHour: number;
  /** The first time strictly after `after` that the email is due at `hour` on the zone's wall clock. */
  next(after: Date, hour: number, timeZone: string): Date;
  /** The period a local day (YYYY-MM-DD) falls in; a period gets at most one email. */
  period(localDate: string): string;
}
