const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;
const CONFIG_FILE = path.join(__dirname, 'config.json');

app.use(cors());
app.use(bodyParser.json());

const getJournalPath = () => {
    if (fs.existsSync(CONFIG_FILE)) {
        const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        return path.resolve(__dirname, config.journalFilePath || '../journal.txt');
    }
    return path.join(__dirname, '../journal.txt');
};

const parseEntries = (content) => {
    const entries = [];
    if (!content.trim()) {
        console.log('[PARSE] Content is empty');
        return [];
    }

    console.log('[PARSE] Content length:', content.length);

    const dayBlocks = content.split(/^-{80}$/m);
    console.log('[PARSE] Day blocks count:', dayBlocks.length);

    dayBlocks.forEach((block, blockIndex) => {
        if (!block.trim()) return;

        const entryBlocks = block.split(/^\*{80}$/m);

        let currentDayDate = null;

        entryBlocks.forEach((entryBlock, entryIndex) => {
            const trimmed = entryBlock.trim();
            if (!trimmed) return;

            const lines = trimmed.split('\n');
            const headerLine = lines[0].trim();

            const headerMatch = /^---(\d{4}\.\d{2}\.\d{2}|\d+)--\[(.*?)\]$/.exec(headerLine);

            if (headerMatch) {
                const identifier = headerMatch[1];
                const tags = headerMatch[2].split(',').map(t => t.trim()).filter(t => t);
                const content = lines.slice(1).join('\n').trim();

                let date;
                let index = 1;

                if (identifier.includes('.')) {
                    date = identifier;
                    currentDayDate = date;
                } else {
                    index = parseInt(identifier);
                    date = currentDayDate;
                }

                if (date) {
                    entries.push({
                        date,
                        index,
                        tags,
                        content
                    });
                }
            }
        });
    });

    console.log('[PARSE] Total entries parsed:', entries.length);

    return entries.sort((a, b) => {
        if (a.date !== b.date) {
            return new Date(b.date) - new Date(a.date);
        }
        return a.index - b.index;
    });
};

const serializeEntries = (entries) => {
    const grouped = {};
    entries.forEach(e => {
        if (!grouped[e.date]) grouped[e.date] = [];
        grouped[e.date].push(e);
    });

    const dates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

    const dayBlocks = dates.map(date => {
        const dayEntries = grouped[date].sort((a, b) => a.index - b.index);

        const serializedDayEntries = dayEntries.map((e, i) => {
            const index = i + 1;
            const tagStr = e.tags.join(', ');
            let header;
            if (i === 0) {
                header = `---${date}--[${tagStr}]`;
            } else {
                header = `---${index}--[${tagStr}]`;
            }
            return `${header}\n${e.content}`;
        });

        return serializedDayEntries.join('\n\n' + '*'.repeat(80) + '\n\n');
    });

    return dayBlocks.join('\n\n' + '-'.repeat(80) + '\n\n');
};

app.get('/api/config', (req, res) => {
    if (fs.existsSync(CONFIG_FILE)) {
        res.json(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')));
    } else {
        res.json({});
    }
});

app.post('/api/config', (req, res) => {
    const newConfig = req.body;
    let config = {};
    if (fs.existsSync(CONFIG_FILE)) {
        config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
    const updatedConfig = { ...config, ...newConfig };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updatedConfig, null, 2));
    res.json({ success: true });
});

app.get('/api/entries', (req, res) => {
    const journalFile = getJournalPath();
    if (!fs.existsSync(journalFile)) {
        return res.json({ entries: [], total: 0 });
    }

    fs.readFile(journalFile, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to read journal file' });
        }

        let entries = parseEntries(data);

        const { search, tag, date, page = 1, limit = 10 } = req.query;

        if (search) {
            const searchLower = search.toLowerCase();
            entries = entries.filter(e =>
                e.content.toLowerCase().includes(searchLower) ||
                e.tags.some(t => t.toLowerCase().includes(searchLower))
            );
        }

        if (tag) {
            const tagLower = tag.toLowerCase();
            entries = entries.filter(e => e.tags.some(t => t.toLowerCase() === tagLower));
        }

        if (date) {
            entries = entries.filter(e => e.date === date);
        }

        const total = entries.length;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = startIndex + limitNum;

        const paginatedEntries = entries.slice(startIndex, endIndex);
        const allTags = [...new Set(entries.flatMap(e => e.tags))];

        res.json({
            entries: paginatedEntries,
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
            allTags
        });
    });
});

app.post('/api/entries', (req, res) => {
    const { text, tags, date } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'Text is required' });
    }

    const journalFile = getJournalPath();

    let dateStr;
    if (date) {
        dateStr = date;
    } else {
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        dateStr = `${yyyy}.${mm}.${dd}`;
    }

    let fileContent = '';
    if (fs.existsSync(journalFile)) {
        fileContent = fs.readFileSync(journalFile, 'utf8');
    }

    const entries = parseEntries(fileContent);
    const dayEntries = entries.filter(e => e.date === dateStr);
    const nextIndex = dayEntries.length + 1;

    const newEntry = {
        date: dateStr,
        index: nextIndex,
        tags: tags || [],
        content: text
    };

    entries.push(newEntry);
    const newFileContent = serializeEntries(entries);

    fs.writeFile(journalFile, newFileContent, (err) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to write to journal file' });
        }
        res.json({ success: true });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
