/**
 * Modern CLI logger utilities for better UX
 * Uses chalk-like ANSI colors without external dependencies
 */

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',

    // Foreground colors
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    gray: '\x1b[90m',

    // Bright colors
    brightRed: '\x1b[91m',
    brightGreen: '\x1b[92m',
    brightYellow: '\x1b[93m',
    brightBlue: '\x1b[94m',
    brightMagenta: '\x1b[95m',
    brightCyan: '\x1b[96m',

    // Background colors
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
} as const;

const c = colors;

/**
 * Format text with color
 */
export const fmt = {
    bold: (text: string) => `${c.bold}${text}${c.reset}`,
    dim: (text: string) => `${c.dim}${text}${c.reset}`,
    red: (text: string) => `${c.red}${text}${c.reset}`,
    green: (text: string) => `${c.green}${text}${c.reset}`,
    yellow: (text: string) => `${c.yellow}${text}${c.reset}`,
    blue: (text: string) => `${c.blue}${text}${c.reset}`,
    magenta: (text: string) => `${c.magenta}${text}${c.reset}`,
    cyan: (text: string) => `${c.cyan}${text}${c.reset}`,
    gray: (text: string) => `${c.gray}${text}${c.reset}`,
    brightGreen: (text: string) => `${c.brightGreen}${text}${c.reset}`,
    brightRed: (text: string) => `${c.brightRed}${text}${c.reset}`,
    brightYellow: (text: string) => `${c.brightYellow}${text}${c.reset}`,
    brightCyan: (text: string) => `${c.brightCyan}${text}${c.reset}`,
};

/**
 * Icons for different message types
 */
const icons = {
    info: 'ℹ',
    success: '✔',
    warning: '⚠',
    error: '✖',
    step: '→',
    arrow: '➜',
    bullet: '•',
    star: '★',
    sparkle: '✨',
    rocket: '🚀',
    database: '🗄️',
    trash: '🗑️',
    seed: '🌱',
    check: '✓',
    cross: '✗',
    hourglass: '⏳',
    clock: '🕐',
} as const;

/**
 * Logging functions with icons and colors
 */
export const log = {
    info: (msg: string) => console.log(`${c.blue}${icons.info}${c.reset} ${msg}`),
    success: (msg: string) => console.log(`${c.green}${icons.success}${c.reset} ${msg}`),
    warning: (msg: string) => console.log(`${c.yellow}${icons.warning}${c.reset} ${msg}`),
    error: (msg: string) => console.log(`${c.red}${icons.error}${c.reset} ${msg}`),
    step: (msg: string) => console.log(`${c.cyan}${icons.step}${c.reset} ${msg}`),
    bullet: (msg: string) => console.log(`  ${c.gray}${icons.bullet}${c.reset} ${msg}`),
    dim: (msg: string) => console.log(`${c.dim}${msg}${c.reset}`),

    // Special purpose
    database: (msg: string) => console.log(`${icons.database}  ${msg}`),
    seed: (msg: string) => console.log(`${icons.seed} ${msg}`),
    trash: (msg: string) => console.log(`${icons.trash}  ${msg}`),
    rocket: (msg: string) => console.log(`${icons.rocket} ${msg}`),
};

/**
 * Create a header/banner
 */
export function banner(title: string, subtitle = ''): void {
    const line = '─'.repeat(50);
    console.log('');
    console.log(`${c.magenta}${line}${c.reset}`);
    console.log(`${c.bold}${c.brightMagenta}  ${icons.sparkle} ${title} ${icons.sparkle}${c.reset}`);
    if (subtitle) {
        console.log(`${c.dim}  ${subtitle}${c.reset}`);
    }
    console.log(`${c.magenta}${line}${c.reset}`);
    console.log('');
}

/**
 * Create a section header
 */
export function section(title: string): void {
    console.log('');
    console.log(`${c.cyan}${c.bold}▸ ${title}${c.reset}`);
    console.log(`${c.dim}${'─'.repeat(40)}${c.reset}`);
}

/**
 * Create a summary box
 */
export function summaryBox(title: string, items: [string, string][]): void {
    const maxKeyLen = Math.max(...items.map(([k]) => k.length));
    console.log('');
    console.log(`${c.bold}${c.white}┌${'─'.repeat(48)}┐${c.reset}`);
    console.log(`${c.bold}${c.white}│${c.reset} ${c.bold}${title.padEnd(46)}${c.bold}${c.white} │${c.reset}`);
    console.log(`${c.bold}${c.white}├${'─'.repeat(48)}┤${c.reset}`);
    for (const [key, value] of items) {
        const paddedKey = key.padEnd(maxKeyLen);
        console.log(`${c.bold}${c.white}│${c.reset} ${c.dim}${paddedKey}${c.reset}  ${value.toString().padEnd(46 - maxKeyLen - 2)}${c.bold}${c.white}│${c.reset}`);
    }
    console.log(`${c.bold}${c.white}└${'─'.repeat(48)}┘${c.reset}`);
    console.log('');
}

interface ProgressHandle {
    succeed: (msg?: string) => void;
    fail: (msg?: string) => void;
    stop: () => void;
}

/**
 * Progress indicator (simple spinner-like)
 */
export function startProgress(message: string): ProgressHandle {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;

    process.stdout.write(`${c.cyan}${frames[0]}${c.reset} ${message}`);

    const interval = setInterval(() => {
        i = (i + 1) % frames.length;
        process.stdout.write(`\r${c.cyan}${frames[i]}${c.reset} ${message}`);
    }, 80);

    return {
        succeed: (msg?: string) => {
            clearInterval(interval);
            process.stdout.write(`\r${c.green}${icons.success}${c.reset} ${msg || message}\n`);
        },
        fail: (msg?: string) => {
            clearInterval(interval);
            process.stdout.write(`\r${c.red}${icons.error}${c.reset} ${msg || message}\n`);
        },
        stop: () => {
            clearInterval(interval);
            process.stdout.write('\r' + ' '.repeat(message.length + 4) + '\r');
        },
    };
}

/**
 * Format a table of data
 */
export function table(headers: string[], rows: (string | number)[][]): void {
    const colWidths = headers.map((h, i) =>
        Math.max(h.length, ...rows.map((r) => String(r[i] || '').length)),
    );

    const headerLine = headers
        .map((h, i) => `${c.bold}${h.padEnd(colWidths[i])}${c.reset}`)
        .join('  ');

    const separator = colWidths.map((w) => '─'.repeat(w)).join('──');

    console.log(`  ${headerLine}`);
    console.log(`  ${c.dim}${separator}${c.reset}`);

    for (const row of rows) {
        const line = row.map((cell, i) => String(cell || '').padEnd(colWidths[i])).join('  ');
        console.log(`  ${line}`);
    }
}

interface Thresholds {
    good: number;
    warn: number;
}

/**
 * Format a score with color based on threshold
 */
export function formatScore(value: number | null | undefined, thresholds: Thresholds = { good: 80, warn: 50 }): string {
    if (value === null || value === undefined) {
        return `${c.dim}N/A${c.reset}`;
    }

    const num = Number(value);
    if (isNaN(num)) {
        return `${c.dim}${value}${c.reset}`;
    }

    let color: string = c.red;
    if (num >= thresholds.good) {
        color = c.green;
    } else if (num >= thresholds.warn) {
        color = c.yellow;
    }

    return `${color}${num}%${c.reset}`;
}

/**
 * Format duration in human readable format
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

/**
 * Print newlines
 */
export function newline(count = 1): void {
    console.log('\n'.repeat(count - 1));
}

export default {
    log,
    fmt,
    banner,
    section,
    summaryBox,
    startProgress,
    table,
    formatScore,
    formatDuration,
    newline,
};
