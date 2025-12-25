const { exec } = require('child_process');
const os = require('os');

const isWindows = os.platform() === 'win32';

const command = isWindows
    ? 'taskkill /F /IM node.exe'
    : 'pkill -f node';

console.log(`Running: ${command}`);

exec(command, (error, stdout, stderr) => {
    if (error) {
        // Check for "no process found" errors to handle gracefully
        const msg = error.message.toLowerCase();
        if (
            msg.includes('not found') ||
            msg.includes('no process') ||
            (isWindows && error.code === 128)
        ) {
            console.log('No Node.js processes found to kill.');
        } else {
            console.warn(`Warning: ${error.message}`);
        }
        return;
    }

    if (stdout) console.log(stdout.trim());
    if (stderr) console.error(stderr.trim());
    console.log('Node.js processes killed successfully.');
});
