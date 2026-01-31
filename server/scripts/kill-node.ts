#!/usr/bin/env ts-node
/**
 * Kill Node Processes Script
 * Terminates all running Node.js processes (useful for dev cleanup)
 */

import { exec } from 'child_process';
import * as os from 'os';
import { log, banner, fmt } from './lib/logger';

const isWindows = os.platform() === 'win32';

const command = isWindows ? 'taskkill /F /IM node.exe' : 'pkill -f node';

banner('PROCESS KILLER', 'Terminating Node.js processes');

log.step(`Running: ${fmt.dim(command)}`);

exec(command, (error, stdout, stderr) => {
    if (error) {
        // Check for "no process found" errors to handle gracefully
        const msg = error.message.toLowerCase();
        if (msg.includes('not found') || msg.includes('no process') || (isWindows && error.code === 128)) {
            log.info('No Node.js processes found to kill');
        } else {
            log.warning(`Warning: ${error.message}`);
        }
        return;
    }

    if (stdout) {
        console.log(stdout.trim());
    }
    if (stderr) {
        console.error(stderr.trim());
    }

    log.success('Node.js processes killed successfully');
});
