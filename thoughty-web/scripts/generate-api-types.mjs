import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectDir = resolve(scriptDir, '..');
const schemaPath = resolve(projectDir, '..', 'thoughty-server', 'openapi', 'openapi.json');
const outputPath = resolve(projectDir, 'src', 'generated', 'openapi.d.ts');
const binaryPath = resolve(projectDir, 'node_modules', '.bin', process.platform === 'win32' ? 'openapi-typescript.cmd' : 'openapi-typescript');

mkdirSync(dirname(outputPath), { recursive: true });

execSync(`"${binaryPath}" "${schemaPath}" -o "${outputPath}"`, {
  cwd: projectDir,
  stdio: 'inherit',
  shell: true,
});

console.log(`OpenAPI types written to ${outputPath}`);