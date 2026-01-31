/**
 * FileConverter Utility Tests
 */

const {
    DEFAULT_FORMAT,
    validateFormatConfig,
    generateTextFile,
    parseTextFile,
    findDuplicates
} = require('../src/utils/fileConverter');

describe('FileConverter Utility', () => {
    describe('DEFAULT_FORMAT', () => {
        it('should have all required fields', () => {
            expect(DEFAULT_FORMAT.entrySeparator).toBeDefined();
            expect(DEFAULT_FORMAT.sameDaySeparator).toBeDefined();
            expect(DEFAULT_FORMAT.datePrefix).toBeDefined();
            expect(DEFAULT_FORMAT.dateSuffix).toBeDefined();
            expect(DEFAULT_FORMAT.dateFormat).toBe('YYYY-MM-DD');
            expect(DEFAULT_FORMAT.tagOpenBracket).toBe('[');
            expect(DEFAULT_FORMAT.tagCloseBracket).toBe(']');
            expect(DEFAULT_FORMAT.tagSeparator).toBe(',');
        });
    });

    describe('validateFormatConfig', () => {
        it('should return defaults when no config provided', () => {
            const config = validateFormatConfig();
            expect(config.dateFormat).toBe('YYYY-MM-DD');
            expect(config.tagSeparator).toBe(',');
        });

        it('should return defaults when empty config provided', () => {
            const config = validateFormatConfig({});
            expect(config.dateFormat).toBe('YYYY-MM-DD');
        });

        it('should use custom values when provided', () => {
            const config = validateFormatConfig({
                dateFormat: 'DD/MM/YYYY',
                tagSeparator: ';'
            });
            expect(config.dateFormat).toBe('DD/MM/YYYY');
            expect(config.tagSeparator).toBe(';');
        });

        it('should handle empty string values for prefix/suffix', () => {
            const config = validateFormatConfig({
                datePrefix: '',
                dateSuffix: ''
            });
            expect(config.datePrefix).toBe('');
            expect(config.dateSuffix).toBe('');
        });
    });

    describe('generateTextFile', () => {
        it('should generate text file from entries', () => {
            const entries = [
                { date: '2024-01-01', index: 1, tags: ['work'], content: 'Entry 1' }
            ];

            const result = generateTextFile(entries);

            expect(result).toContain('2024-01-01');
            expect(result).toContain('[work]');
            expect(result).toContain('Entry 1');
        });

        it('should handle multiple entries on same day', () => {
            const entries = [
                { date: '2024-01-01', index: 1, tags: ['work'], content: 'Entry 1' },
                { date: '2024-01-01', index: 2, tags: ['personal'], content: 'Entry 2' }
            ];

            const result = generateTextFile(entries);

            expect(result).toContain('Entry 1');
            expect(result).toContain('Entry 2');
            expect(result).toContain(DEFAULT_FORMAT.sameDaySeparator);
        });

        it('should handle entries on different days', () => {
            const entries = [
                { date: '2024-01-01', index: 1, tags: ['work'], content: 'Day 1' },
                { date: '2024-01-02', index: 1, tags: ['personal'], content: 'Day 2' }
            ];

            const result = generateTextFile(entries);

            expect(result).toContain('2024-01-01');
            expect(result).toContain('2024-01-02');
            expect(result).toContain(DEFAULT_FORMAT.entrySeparator);
        });

        it('should sort entries by date and index', () => {
            const entries = [
                { date: '2024-01-02', index: 1, tags: ['b'], content: 'Second' },
                { date: '2024-01-01', index: 1, tags: ['a'], content: 'First' }
            ];

            const result = generateTextFile(entries);
            const firstIndex = result.indexOf('First');
            const secondIndex = result.indexOf('Second');

            expect(firstIndex).toBeLessThan(secondIndex);
        });

        it('should handle empty entries array', () => {
            const result = generateTextFile([]);
            expect(result).toBe('');
        });

        it('should handle entries with no tags', () => {
            const entries = [
                { date: '2024-01-01', index: 1, tags: [], content: 'No tags' }
            ];

            const result = generateTextFile(entries);
            expect(result).toContain('[]');
        });

        it('should handle Date objects', () => {
            const entries = [
                { date: new Date('2024-01-01'), index: 1, tags: ['work'], content: 'Entry' }
            ];

            const result = generateTextFile(entries);
            expect(result).toContain('2024-01-01');
        });

        it('should handle content in text field', () => {
            const entries = [
                { date: '2024-01-01', index: 1, tags: ['work'], text: 'Entry from text field' }
            ];

            const result = generateTextFile(entries);
            expect(result).toContain('Entry from text field');
        });

        it('should use custom format config', () => {
            const entries = [
                { date: '2024-01-15', index: 1, tags: ['work', 'personal'], content: 'Entry' }
            ];

            const config = {
                tagSeparator: ';',
                tagOpenBracket: '(',
                tagCloseBracket: ')'
            };

            const result = generateTextFile(entries, config);
            expect(result).toContain('(work;personal)');
        });
    });

    describe('parseTextFile', () => {
        it('should parse a simple text file', () => {
            const content = `
---2024-01-01--[work,personal]
This is an entry.

--------------------------------------------------------------------------------
`;

            const result = parseTextFile(content);

            expect(result).toHaveLength(1);
            expect(result[0].date).toBe('2024-01-01');
            expect(result[0].tags).toEqual(['work', 'personal']);
            expect(result[0].content).toBe('This is an entry.');
        });

        it('should parse multiple entries on same day', () => {
            const content = `
---2024-01-01--[work]
First entry.

********************************************************************************

---2--[personal]
Second entry.

--------------------------------------------------------------------------------
`;

            const result = parseTextFile(content);

            expect(result).toHaveLength(2);
            expect(result[0].index).toBe(1);
            expect(result[1].index).toBe(2);
        });

        it('should parse multiple days', () => {
            const content = `
---2024-01-01--[work]
Day 1 entry.

--------------------------------------------------------------------------------

---2024-01-02--[personal]
Day 2 entry.

--------------------------------------------------------------------------------
`;

            const result = parseTextFile(content);

            expect(result).toHaveLength(2);
            expect(result[0].date).toBe('2024-01-01');
            expect(result[1].date).toBe('2024-01-02');
        });

        it('should handle empty content', () => {
            const result = parseTextFile('');
            expect(result).toHaveLength(0);
        });

        it('should handle CRLF line endings', () => {
            const content = '---2024-01-01--[work]\r\nEntry content.\r\n--------------------------------------------------------------------------------';

            const result = parseTextFile(content);

            expect(result).toHaveLength(1);
            expect(result[0].content).toBe('Entry content.');
        });

        it('should handle CR only line endings', () => {
            const content = '---2024-01-01--[work]\rEntry content.\r--------------------------------------------------------------------------------';

            const result = parseTextFile(content);

            expect(result).toHaveLength(1);
        });

        it('should handle multiline content', () => {
            const content = `
---2024-01-01--[work]
Line 1
Line 2
Line 3

--------------------------------------------------------------------------------
`;

            const result = parseTextFile(content);

            expect(result).toHaveLength(1);
            expect(result[0].content).toContain('Line 1');
            expect(result[0].content).toContain('Line 2');
            expect(result[0].content).toContain('Line 3');
        });

        it('should use custom format config', () => {
            const content = `
***2024-01-01**(work;personal)
Entry with custom format.

================================================================================
`;

            const config = {
                datePrefix: '***',
                dateSuffix: '**',
                tagOpenBracket: '(',
                tagCloseBracket: ')',
                tagSeparator: ';',
                entrySeparator: '================================================================================'
            };

            const result = parseTextFile(content, config);

            expect(result).toHaveLength(1);
            expect(result[0].tags).toEqual(['work', 'personal']);
        });

        it('should ignore entries with empty content', () => {
            const content = `
---2024-01-01--[work]


--------------------------------------------------------------------------------
`;

            const result = parseTextFile(content);
            expect(result).toHaveLength(0);
        });
    });

    describe('findDuplicates', () => {
        it('should find exact duplicates', () => {
            const imported = [
                { date: '2024-01-01', content: 'Same content' }
            ];
            const existing = [
                { date: '2024-01-01', content: 'Same content' }
            ];

            const result = findDuplicates(imported, existing);

            expect(result).toHaveLength(1);
            expect(result[0].imported).toBeDefined();
            expect(result[0].existing).toBeDefined();
        });

        it('should not flag different content as duplicate', () => {
            const imported = [
                { date: '2024-01-01', content: 'New content' }
            ];
            const existing = [
                { date: '2024-01-01', content: 'Different content' }
            ];

            const result = findDuplicates(imported, existing);

            expect(result).toHaveLength(0);
        });

        it('should not flag same content on different dates', () => {
            const imported = [
                { date: '2024-01-02', content: 'Same content' }
            ];
            const existing = [
                { date: '2024-01-01', content: 'Same content' }
            ];

            const result = findDuplicates(imported, existing);

            expect(result).toHaveLength(0);
        });

        it('should handle Date objects in existing entries', () => {
            const imported = [
                { date: '2024-01-01', content: 'Same content' }
            ];
            const existing = [
                { date: new Date('2024-01-01'), content: 'Same content' }
            ];

            const result = findDuplicates(imported, existing);

            expect(result).toHaveLength(1);
        });

        it('should handle empty arrays', () => {
            expect(findDuplicates([], [])).toHaveLength(0);
            expect(findDuplicates([], [{ date: '2024-01-01', content: 'test' }])).toHaveLength(0);
            expect(findDuplicates([{ date: '2024-01-01', content: 'test' }], [])).toHaveLength(0);
        });

        it('should ignore whitespace differences', () => {
            const imported = [
                { date: '2024-01-01', content: '  Same content  ' }
            ];
            const existing = [
                { date: '2024-01-01', content: 'Same content' }
            ];

            const result = findDuplicates(imported, existing);

            expect(result).toHaveLength(1);
        });

        it('should handle null content in existing entries', () => {
            const imported = [
                { date: '2024-01-01', content: 'Some content' }
            ];
            const existing = [
                { date: '2024-01-01', content: null }
            ];

            const result = findDuplicates(imported, existing);

            expect(result).toHaveLength(0);
        });
    });
});
