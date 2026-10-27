/** Words in one entry (alias `e`): its text split on whitespace, none for an empty text. */
export const ENTRY_WORDS_SQL = String.raw`CASE WHEN BTRIM(e.content) = '' THEN 0 ELSE CARDINALITY(REGEXP_SPLIT_TO_ARRAY(BTRIM(e.content), '\s+')) END`;
