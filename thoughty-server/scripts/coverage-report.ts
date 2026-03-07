#!/usr/bin/env ts-node
/**
 * Coverage Report Script
 * Runs tests with coverage for both backend and frontend, then summarizes results
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { banner, section, summaryBox, log, fmt, formatScore as fmtScore } from './lib/logger';

// Regex to strip ANSI escape codes
// eslint-disable-next-line no-control-regex
const STRIP_ANSI = /\x1B\[\d+m/g;

interface CoverageResult {
    name: string;
    coverage: number | null;
}

async function runTest(name: string, dir: string, script: string = 'test:cov'): Promise<CoverageResult> {
    section(`${name.toUpperCase()} COVERAGE`);
    log.step(`Running tests in ${fmt.dim(dir)}...`);

    return new Promise((resolve) => {
        // Use npm.cmd on Windows
        const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

        const child = spawn(npmCmd, ['run', script], {
            cwd: path.resolve(dir),
            shell: true,
            env: { ...process.env, FORCE_COLOR: '0' },
        });

        let output = '';

        child.stdout.on('data', (data) => {
            const str = data.toString();
            process.stdout.write(str);
            output += str;
        });

        child.stderr.on('data', (data) => {
            const str = data.toString();
            process.stderr.write(str);
            output += str;
        });

        child.on('close', () => {
            const lines = output.split('\n');
            let coverage: number | null = null;

            for (const rawLine of lines) {
                const line = rawLine.replaceAll(STRIP_ANSI, '');
                if (line.includes('All files')) {
                    const parts = line.split('|').map((s) => s.trim());
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

            if (coverage !== null) {
                log.success(`${name} coverage: ${fmtScore(coverage)}`);
            } else {
                log.warning(`Could not parse ${name} coverage`);
            }

            resolve({ name, coverage });
        });
    });
}

// Main execution
async function main(): Promise<void> {
    banner('TEST COVERAGE REPORT', 'Running full test suite with coverage analysis');

    const startTime = Date.now();
    const rootDir = path.resolve(__dirname, '..', '..');
    const backend = await runTest('Backend', path.join(rootDir, 'server'), 'test:cov');
    const frontend = await runTest('Frontend', path.join(rootDir, 'client'), 'test:coverage');
    const duration = Date.now() - startTime;

    // Build summary items
    const summaryItems: [string, string][] = [
        ['⚙️  Backend', fmtScore(backend.coverage)],
        ['🖥️  Frontend', fmtScore(frontend.coverage)],
    ];

    if (backend.coverage !== null && frontend.coverage !== null) {
        const average = ((backend.coverage + frontend.coverage) / 2).toFixed(2);
        const avgNum = Number.parseFloat(average);

        let emoji = '😐';
        if (avgNum >= 90) emoji = '🚀';
        else if (avgNum >= 80) emoji = '🎉';
        else if (avgNum >= 70) emoji = '👍';
        else if (avgNum >= 50) emoji = '🔨';
        else emoji = '⚠️';

        summaryItems.push(['', '']);
        summaryItems.push([`${emoji} Average`, fmtScore(avgNum)]);
    }

    summaryItems.push(['', '']);
    summaryItems.push(['⏱️  Duration', `${Math.round(duration / 1000)}s`]);

    summaryBox('COVERAGE SUMMARY', summaryItems);
}

main();
