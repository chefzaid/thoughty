#!/usr/bin/env ts-node
/**
 * Coverage Report Script
 * Runs tests with coverage for both backend and frontend, then summarizes results
 */

import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { banner, section, summaryBox, log, fmt, formatScore as fmtScore } from './lib/logger';

// Regex to strip ANSI escape codes
 
const STRIP_ANSI = /\x1B\[\d+m/g;

interface CoverageResult {
    name: string;
    coverage: number | null;
}

async function runTest(name: string, dir: string, script: string = 'test:cov'): Promise<CoverageResult> {
    section(`${name.toUpperCase()} COVERAGE`);
    log.step(`Running tests in ${fmt.dim(dir)}...`);

    return new Promise((resolve) => {
        const npmExecPath = process.env.npm_execpath;
        const command = npmExecPath ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
        const args = npmExecPath ? [npmExecPath, 'run', script] : ['run', script];

        const child = spawn(command, args, {
            cwd: path.resolve(dir),
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
                        if (!Number.isNaN(val)) {
                            coverage = val;
                        }
                    }
                    if (coverage === null) {
                        continue;
                    }
                    break;
                }
            }

            if (coverage === null) {
                log.warning(`Could not parse ${name} coverage`);
            } else {
                log.success(`${name} coverage: ${fmtScore(coverage)}`);
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
    const backend = await runTest('Backend', path.join(rootDir, 'thoughty-server'), 'test:cov');
    const frontend = await runTest('Frontend', path.join(rootDir, 'thoughty-web'), 'test:coverage');
    const duration = Date.now() - startTime;

    // Build summary items
    const summaryItems: [string, string][] = [
        ['Backend', fmtScore(backend.coverage)],
        ['Frontend', fmtScore(frontend.coverage)],
    ];

    if (backend.coverage !== null && frontend.coverage !== null) {
        const average = ((backend.coverage + frontend.coverage) / 2).toFixed(2);
        const avgNum = Number.parseFloat(average);

        summaryItems.push(['Average', fmtScore(avgNum)]);
    }

    summaryItems.push(['Duration', `${Math.round(duration / 1000)}s`]);

    summaryBox('COVERAGE SUMMARY', summaryItems);
}

main();
