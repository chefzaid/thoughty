import { existsSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const isWindows = os.platform() === 'win32';
const playwrightCli = path.join(process.cwd(), 'node_modules', 'playwright', 'cli.js');
const msPlaywrightDir = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright');

function runNode(args) {
  return spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

function printResult(result) {
  if (result.stdout) {
    process.stdout.write(result.stdout);
  }
  if (result.stderr) {
    process.stderr.write(result.stderr);
  }
}

function removeIfExists(targetPath) {
  if (existsSync(targetPath)) {
    rmSync(targetPath, { force: true, recursive: true });
  }
}

function expectedExecutableExists(installLocation) {
  const executablePath = getExpectedExecutablePath(installLocation);
  return executablePath ? existsSync(executablePath) : true;
}

function getExpectedExecutablePath(installLocation) {
  const folderName = path.basename(installLocation);

  if (folderName.startsWith('chromium_headless_shell-')) {
    return path.join(installLocation, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
  }

  if (folderName.startsWith('chromium-')) {
    return path.join(installLocation, 'chrome-win64', 'chrome.exe');
  }

  if (folderName.startsWith('ffmpeg-')) {
    return path.join(installLocation, 'ffmpeg-win64', 'ffmpeg.exe');
  }

  if (folderName.startsWith('winldd-')) {
    return path.join(installLocation, 'winldd-win64', 'winldd.exe');
  }

  return null;
}

function getInstallLocations() {
  const dryRun = runNode([playwrightCli, 'install', '--dry-run', 'chromium']);
  if (dryRun.status !== 0) {
    printResult(dryRun);
    throw new Error('Unable to inspect Playwright install metadata.');
  }

  const locations = [...dryRun.stdout.matchAll(/Install location:\s+(.+)$/gm)]
    .map((match) => match[1]?.trim())
    .filter(Boolean);

  return Array.from(new Set(locations));
}

function getInstallArtifacts() {
  const dryRun = runNode([playwrightCli, 'install', '--dry-run', 'chromium']);
  if (dryRun.status !== 0) {
    printResult(dryRun);
    throw new Error('Unable to inspect Playwright install metadata.');
  }

  const artifacts = [];
  const lines = dryRun.stdout.split(/\r?\n/);
  let currentName = '';
  let currentLocation = '';

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (!rawLine.startsWith('  ') && line.includes('(playwright ')) {
      currentName = line;
      currentLocation = '';
      continue;
    }

    if (line.startsWith('Install location:')) {
      currentLocation = line.replace('Install location:', '').trim();
      continue;
    }

    if (line.startsWith('Download url:') && currentLocation) {
      artifacts.push({
        name: currentName,
        installLocation: currentLocation,
        downloadUrl: line.replace('Download url:', '').trim(),
      });
      currentName = '';
      currentLocation = '';
    }
  }

  return artifacts;
}

function isManagedPlaywrightDirectory(name) {
  return (
    name.startsWith('chromium-') ||
    name.startsWith('chromium_headless_shell-') ||
    name.startsWith('ffmpeg-') ||
    name.startsWith('winldd-')
  );
}

function cleanupIncompleteInstallLocation(installLocation) {
  if (!installLocation.startsWith(msPlaywrightDir)) {
    return;
  }

  if (!existsSync(installLocation)) {
    return;
  }

  if (!expectedExecutableExists(installLocation)) {
    removeIfExists(installLocation);
  }
}

function installArtifactOnWindows(artifact) {
  if (expectedExecutableExists(artifact.installLocation)) {
    return;
  }

  const expectedPath = getExpectedExecutablePath(artifact.installLocation);
  if (!expectedPath) {
    throw new Error(`Unknown executable path for ${artifact.name}.`);
  }

  const zipPath = path.join(os.tmpdir(), `${path.basename(artifact.installLocation)}.zip`);
  removeIfExists(zipPath);
  removeIfExists(artifact.installLocation);

  const command = [
    `$ProgressPreference = 'SilentlyContinue'`,
    `Invoke-WebRequest '${artifact.downloadUrl}' -OutFile '${zipPath}'`,
    `Expand-Archive -Path '${zipPath}' -DestinationPath '${artifact.installLocation}' -Force`,
    `Remove-Item '${zipPath}' -Force -ErrorAction SilentlyContinue`,
    `if (-not (Test-Path '${expectedPath}')) { exit 1 }`,
  ].join('; ');

  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', command], {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: 'pipe',
  });

  printResult(result);

  if (result.status !== 0) {
    throw new Error(`Unable to provision ${artifact.name}.`);
  }
}

function cleanupWindowsPlaywrightCache() {
  removeIfExists(path.join(msPlaywrightDir, '__dirlock'));

  for (const installLocation of getInstallLocations()) {
    cleanupIncompleteInstallLocation(installLocation);
  }

  if (!existsSync(msPlaywrightDir)) {
    return;
  }

  for (const child of readdirSync(msPlaywrightDir, { withFileTypes: true })) {
    if (!child.isDirectory()) {
      continue;
    }

    const childPath = path.join(msPlaywrightDir, child.name);
    if (isManagedPlaywrightDirectory(child.name)) {
      cleanupIncompleteInstallLocation(childPath);
    }
  }
}

function installChromium() {
  const install = runNode([playwrightCli, 'install', 'chromium']);
  printResult(install);
  return install;
}

function installChromiumOnWindows() {
  cleanupWindowsPlaywrightCache();

  for (const artifact of getInstallArtifacts()) {
    if (!artifact.installLocation.startsWith(msPlaywrightDir)) {
      continue;
    }

    const artifactDirName = path.basename(artifact.installLocation);
    if (!artifactDirName.startsWith('chromium-') && !artifactDirName.startsWith('chromium_headless_shell-')) {
      continue;
    }

    installArtifactOnWindows(artifact);
  }
}

try {
  if (isWindows) {
    installChromiumOnWindows();
    process.exit(0);
  }

  let result = installChromium();

  if (isWindows && result.status !== 0 && `${result.stdout}\n${result.stderr}`.includes('__dirlock')) {
    cleanupWindowsPlaywrightCache();
    result = installChromium();
  }

  process.exit(result.status ?? 1);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
}