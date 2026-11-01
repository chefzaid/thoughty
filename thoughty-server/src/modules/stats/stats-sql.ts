/** Words in one entry (alias `e`): its text split on whitespace, none for an empty text. */
export const ENTRY_WORDS_SQL = String.raw`CASE WHEN BTRIM(e.content) = '' THEN 0 ELSE CARDINALITY(REGEXP_SPLIT_TO_ARRAY(BTRIM(e.content), '\s+')) END`;

/*
 * When an entry (alias `e`) was written, in the writer's time zone (the `:timeZone` parameter). Its time
 * of day was typed by the writer on their own clock, so it is already local and its weekday is that of
 * its date. Without one, the entry counts when it was created: `created_at` holds the database
 * session's wall clock (`now()` without a zone), so it is read back in that zone (`::timestamptz`) and
 * turned into the writer's.
 */
const CREATED_LOCAL_SQL = '(e.created_at::timestamptz AT TIME ZONE :timeZone)';
/** The entry's local time of day. */
export const ENTRY_LOCAL_TIME_SQL = `(CASE WHEN e.time_of_day IS NULL THEN ${CREATED_LOCAL_SQL}::time ELSE e.time_of_day END)`;
/** The entry's local hour, 0 to 23. */
export const ENTRY_LOCAL_HOUR_SQL = `EXTRACT(HOUR FROM ${ENTRY_LOCAL_TIME_SQL})::int`;
/** The entry's local ISO weekday, 1 (Monday) to 7 (Sunday). */
export const ENTRY_LOCAL_WEEKDAY_SQL = `CASE WHEN e.time_of_day IS NULL THEN EXTRACT(ISODOW FROM ${CREATED_LOCAL_SQL}) ELSE EXTRACT(ISODOW FROM e.date) END::int`;
