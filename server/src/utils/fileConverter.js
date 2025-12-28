/**
 * File Converter Utility
 * Handles conversion between text file format and database entries
 */

// Default format configuration
const DEFAULT_FORMAT = {
    entrySeparator: '--------------------------------------------------------------------------------',
    sameDaySeparator: '********************************************************************************',
    datePrefix: '---',
    dateSuffix: '--',
    dateFormat: 'YYYY-MM-DD',
    tagOpenBracket: '[',
    tagCloseBracket: ']',
    tagSeparator: ','
};

/**
 * Validate format configuration
 * @param {object} config - Format configuration object
 * @returns {object} Validated config with defaults applied
 */
function validateFormatConfig(config = {}) {
    return {
        entrySeparator: config.entrySeparator || DEFAULT_FORMAT.entrySeparator,
        sameDaySeparator: config.sameDaySeparator || DEFAULT_FORMAT.sameDaySeparator,
        datePrefix: config.datePrefix ?? DEFAULT_FORMAT.datePrefix,
        dateSuffix: config.dateSuffix ?? DEFAULT_FORMAT.dateSuffix,
        dateFormat: config.dateFormat || DEFAULT_FORMAT.dateFormat,
        tagOpenBracket: config.tagOpenBracket ?? DEFAULT_FORMAT.tagOpenBracket,
        tagCloseBracket: config.tagCloseBracket ?? DEFAULT_FORMAT.tagCloseBracket,
        tagSeparator: config.tagSeparator ?? DEFAULT_FORMAT.tagSeparator
    };
}

/**
 * Format a date according to the specified format
 * @param {string|Date} date - Date to format
 * @param {string} format - Format string (e.g., 'YYYY-MM-DD')
 * @returns {string} Formatted date string
 */
function formatDate(date, format) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day);
}

/**
 * Parse a date string according to the specified format
 * @param {string} dateStr - Date string to parse
 * @param {string} format - Format string (e.g., 'YYYY-MM-DD')
 * @returns {string} ISO date string (YYYY-MM-DD)
 */
function parseDate(dateStr, format) {
    // Extract positions from format
    const yearIndex = format.indexOf('YYYY');
    const monthIndex = format.indexOf('MM');
    const dayIndex = format.indexOf('DD');

    const year = dateStr.substring(yearIndex, yearIndex + 4);
    const month = dateStr.substring(monthIndex, monthIndex + 2);
    const day = dateStr.substring(dayIndex, dayIndex + 2);

    return `${year}-${month}-${day}`;
}

/**
 * Generate text file content from entries
 * @param {Array} entries - Array of entry objects from database
 * @param {object} formatConfig - Format configuration
 * @returns {string} Formatted text file content
 */
function generateTextFile(entries, formatConfig = {}) {
    const config = validateFormatConfig(formatConfig);
    const lines = [];
    let currentDate = null;

    // Sort entries by date (ascending) then by index
    const sortedEntries = [...entries].sort((a, b) => {
        const dateCompare = new Date(a.date) - new Date(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.index - b.index;
    });

    for (const entry of sortedEntries) {
        // Handle both Date objects and ISO date strings
        const entryDate = entry.date instanceof Date
            ? entry.date.toISOString().split('T')[0]
            : String(entry.date).split('T')[0];
        const isNewDate = entryDate !== currentDate;

        if (isNewDate) {
            // Add entry separator before new date (except for first entry)
            if (currentDate !== null) {
                lines.push('');
                lines.push(config.entrySeparator);
            }
            currentDate = entryDate;

            // Format: ---YYYY-MM-DD--[tag1,tag2]
            const formattedDate = formatDate(entryDate, config.dateFormat);
            const tagsStr = config.tagOpenBracket +
                (entry.tags || []).join(config.tagSeparator) +
                config.tagCloseBracket;
            lines.push('');
            lines.push(`${config.datePrefix}${formattedDate}${config.dateSuffix}${tagsStr}`);
        } else {
            // Same day entry - use index instead of date
            lines.push('');
            lines.push(config.sameDaySeparator);
            lines.push('');

            // Format: ---2--[tag1,tag2]
            const tagsStr = config.tagOpenBracket +
                (entry.tags || []).join(config.tagSeparator) +
                config.tagCloseBracket;
            lines.push(`${config.datePrefix}${entry.index}${config.dateSuffix}${tagsStr}`);
        }

        // Add entry content
        lines.push(entry.content || entry.text || '');
    }

    // Add final separator
    if (sortedEntries.length > 0) {
        lines.push('');
        lines.push(config.entrySeparator);
    }

    return lines.join('\r\n');
}

/**
 * Parse text file content into entry objects
 * @param {string} content - Text file content
 * @param {object} formatConfig - Format configuration
 * @returns {Array} Array of parsed entry objects
 */
function parseTextFile(content, formatConfig = {}) {
    const config = validateFormatConfig(formatConfig);
    const entries = [];

    // Normalize line endings
    const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalizedContent.split('\n');

    let currentDate = null;
    let currentIndex = 0;
    let currentEntry = null;
    let contentLines = [];

    // Build regex patterns from config
    const escapedPrefix = escapeRegex(config.datePrefix);
    const escapedSuffix = escapeRegex(config.dateSuffix);
    const escapedTagOpen = escapeRegex(config.tagOpenBracket);
    const escapedTagClose = escapeRegex(config.tagCloseBracket);

    // Pattern for full date entry: ---YYYY-MM-DD--[tags]
    const datePattern = new RegExp(
        `^${escapedPrefix}(\\d{4}[-./]\\d{2}[-./]\\d{2})${escapedSuffix}${escapedTagOpen}([^\\]]*?)${escapedTagClose}$`
    );

    // Pattern for same-day entry: ---N--[tags]
    const indexPattern = new RegExp(
        `^${escapedPrefix}(\\d+)${escapedSuffix}${escapedTagOpen}([^\\]]*?)${escapedTagClose}$`
    );

    function saveCurrentEntry() {
        if (currentEntry) {
            currentEntry.content = contentLines.join('\n').trim();
            if (currentEntry.content) {
                entries.push(currentEntry);
            }
            currentEntry = null;
            contentLines = [];
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();

        // Check for separators
        if (trimmedLine === config.entrySeparator || trimmedLine === config.sameDaySeparator) {
            saveCurrentEntry();
            continue;
        }

        // Check for full date entry header
        const dateMatch = trimmedLine.match(datePattern);
        if (dateMatch) {
            saveCurrentEntry();
            currentDate = parseDate(dateMatch[1], config.dateFormat);
            currentIndex = 1;
            const tags = dateMatch[2].split(config.tagSeparator).map(t => t.trim()).filter(t => t);
            currentEntry = {
                date: currentDate,
                index: currentIndex,
                tags: tags
            };
            continue;
        }

        // Check for same-day entry header
        const indexMatch = trimmedLine.match(indexPattern);
        if (indexMatch) {
            saveCurrentEntry();
            currentIndex = parseInt(indexMatch[1], 10);
            const tags = indexMatch[2].split(config.tagSeparator).map(t => t.trim()).filter(t => t);
            currentEntry = {
                date: currentDate,
                index: currentIndex,
                tags: tags
            };
            continue;
        }

        // Regular content line
        if (currentEntry) {
            contentLines.push(line);
        }
    }

    // Save last entry
    saveCurrentEntry();

    return entries;
}

/**
 * Escape special regex characters in a string
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find potential duplicates between imported entries and existing entries
 * @param {Array} importedEntries - Entries to be imported
 * @param {Array} existingEntries - Existing entries in database
 * @returns {Array} Array of duplicate matches { imported, existing }
 */
function findDuplicates(importedEntries, existingEntries) {
    const duplicates = [];

    for (const imported of importedEntries) {
        for (const existing of existingEntries) {
            // Handle both Date objects and ISO date strings
            const existingDate = existing.date instanceof Date
                ? existing.date.toISOString().split('T')[0]
                : String(existing.date).split('T')[0];
            const sameDate = imported.date === existingDate;
            const sameContent = imported.content.trim() === (existing.content || '').trim();

            if (sameDate && sameContent) {
                duplicates.push({
                    imported,
                    existing
                });
                break;
            }
        }
    }

    return duplicates;
}

module.exports = {
    DEFAULT_FORMAT,
    validateFormatConfig,
    generateTextFile,
    parseTextFile,
    findDuplicates,
    formatDate,
    parseDate
};
