/**
 * Where TXT files keep entry titles: on the header line as `--{title:…}` (the default, which
 * leaves files without titles exactly as before), or as the first line under the header (an
 * empty line when the entry has none), for plain-text journals that start each entry with one.
 */
export type TitlePlacement = 'header' | 'firstLine';

export interface FormatConfig {
  entrySeparator: string;
  sameDaySeparator: string;
  datePrefix: string;
  dateSuffix: string;
  dateFormat: string;
  tagOpenBracket: string;
  tagCloseBracket: string;
  tagSeparator: string;
  titlePlacement: TitlePlacement;
}

export const DEFAULT_FORMAT: FormatConfig = {
  entrySeparator:
    '--------------------------------------------------------------------------------',
  sameDaySeparator:
    '********************************************************************************',
  datePrefix: '---',
  dateSuffix: '--',
  dateFormat: 'YYYY-MM-DD',
  tagOpenBracket: '[',
  tagCloseBracket: ']',
  tagSeparator: ',',
  titlePlacement: 'header',
};

/**
 * Validate and merge format configuration with defaults
 */
export function validateFormatConfig(config: Partial<FormatConfig> = {}): FormatConfig {
  return {
    entrySeparator: config.entrySeparator || DEFAULT_FORMAT.entrySeparator,
    sameDaySeparator: config.sameDaySeparator || DEFAULT_FORMAT.sameDaySeparator,
    datePrefix: config.datePrefix ?? DEFAULT_FORMAT.datePrefix,
    dateSuffix: config.dateSuffix ?? DEFAULT_FORMAT.dateSuffix,
    dateFormat: config.dateFormat || DEFAULT_FORMAT.dateFormat,
    tagOpenBracket: config.tagOpenBracket ?? DEFAULT_FORMAT.tagOpenBracket,
    tagCloseBracket: config.tagCloseBracket ?? DEFAULT_FORMAT.tagCloseBracket,
    tagSeparator: config.tagSeparator ?? DEFAULT_FORMAT.tagSeparator,
    titlePlacement: config.titlePlacement === 'firstLine' ? 'firstLine' : DEFAULT_FORMAT.titlePlacement,
  };
}

/**
 * Format a date according to the specified format
 */
export function formatDate(date: string | Date, format: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return format.replace('YYYY', String(year)).replace('MM', month).replace('DD', day);
}

/**
 * Parse a date string according to the specified format
 */
export function parseDate(dateStr: string, format: string): string {
  const yearIndex = format.indexOf('YYYY');
  const monthIndex = format.indexOf('MM');
  const dayIndex = format.indexOf('DD');

  const year = dateStr.substring(yearIndex, yearIndex + 4);
  const month = dateStr.substring(monthIndex, monthIndex + 2);
  const day = dateStr.substring(dayIndex, dayIndex + 2);

  return `${year}-${month}-${day}`;
}
