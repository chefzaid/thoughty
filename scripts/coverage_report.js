const { spawnSync } = require('node:child_process');
const path = require('node:path');

// Regex to strip ANSI escape codes
// eslint-disable-next-line no-control-regex
const STRIP_ANSI = /\x1B\[\d+m/g;

function runTest(name, dir) {
    console.log(`---------------------------------------------------`);
    console.log(`${name.toUpperCase()} COVERAGE`);
    console.log(`---------------------------------------------------`);

    // Use npm.cmd on Windows
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

    const result = spawnSync(npmCmd, ['run', 'test:coverage'], {
        cwd: path.resolve(dir),
        shell: true,
        env: { ...process.env, FORCE_COLOR: '0' },
        encoding: 'utf8'
    });

    const stdout = result.stdout || '';
    const stderr = result.stderr || '';

    process.stdout.write(stdout);
    process.stderr.write(stderr);

    const lines = `${stdout}${stderr}`.split('\n');
    let coverage = null;

    for (const rawLine of lines) {
        const line = rawLine.replaceAll(STRIP_ANSI, '');
        if (line.includes('All files')) {
            const parts = line.split('|').map(s => s.trim());
            // Format reference:
            // All files | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
            // Index 0   |    1    |     2    |    3    |    4    |        5

            if (parts.length > 4) {
                const val = Number.parseFloat(parts[4]);
                if (!Number.isNaN(val)) coverage = val;
            }
            // Break if we found it (assuming first match is what we want)
            if (coverage !== null) break;
        }
    }

    return { name, coverage };
}

// Colors
const RESET = '\x1b[0m';
const BRIGHT = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const CYAN = '\x1b[36m';

const rootDir = path.resolve(__dirname, '..');

const formatScore = (val) => {
    if (val === null) return 'N/A';
    let color = RESET;
    if (val >= 80) {
        color = GREEN;
    } else if (val >= 50) {
        color = YELLOW;
    }
    return `${color}${val}%${RESET}`;
};

const reportSummary = (backend, frontend) => {
    console.log('\n' + MAGENTA + '==============================' + RESET);
    console.log(BRIGHT + '✨ FINAL COVERAGE SUMMARY ✨' + RESET);
    console.log(MAGENTA + '==============================' + RESET);

    console.log(`${CYAN}⚙️  Backend:${RESET} ${formatScore(backend.coverage)}`);
    console.log(`${CYAN}🖥️  Frontend:${RESET} ${formatScore(frontend.coverage)}`);

    if (backend.coverage !== null && frontend.coverage !== null) {
        const average = ((backend.coverage + frontend.coverage) / 2).toFixed(2);
        const avgNum = Number.parseFloat(average);

        let emoji = '😐';
        if (avgNum >= 90) emoji = '🚀';
        else if (avgNum >= 80) emoji = '🎉';
        else if (avgNum >= 60) emoji = '📈';

        console.log(MAGENTA + '------------------------------' + RESET);
        console.log(`${emoji}  ${BRIGHT}AVERAGE: ${formatScore(avgNum)}`);
        console.log(MAGENTA + '==============================' + RESET);
    }
};

try {
    const backend = runTest('Backend', path.join(rootDir, 'server'));
    const frontend = runTest('Frontend', path.join(rootDir, 'client'));
    reportSummary(backend, frontend);
} catch (error) {
    console.error(error);
    process.exitCode = 1;
}
