import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDirectory, '..');
const workspaceRoot = resolve(webRoot, '..');
const openApiPath = join(workspaceRoot, 'thoughty-server', 'openapi', 'openapi.json');
const sourceRoot = join(webRoot, 'src');

const operationalOperations = new Map([
  ['GET /api/health', 'Kubernetes readiness and liveness probes'],
  ['GET /api/metrics', 'Prometheus monitoring scrape'],
]);

function collectSourceFiles(directory) {
  return readdirSync(directory)
    .flatMap((name) => {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) {
        return name === 'generated' ? [] : collectSourceFiles(path);
      }
      return /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.(ts|tsx)$/.test(name) ? [path] : [];
    });
}

function canonicalizeRoute(route) {
  return route
    .replaceAll('${API_BASE}', '/api/auth')
    .replace(/\$\{[^}]+\}/g, '{}')
    .replace(/\{[^}]+\}/g, '{}')
    .split('?')[0]
    .replace(/\/$/, '');
}

function addCandidate(candidates, method, route, file) {
  const canonicalRoute = canonicalizeRoute(route);
  if (!canonicalRoute.startsWith('/api/')) return;
  const key = `${method} ${canonicalRoute}`;
  const currentFiles = candidates.get(key) ?? new Set();
  currentFiles.add(relative(webRoot, file));
  candidates.set(key, currentFiles);
}

function collectRouteCandidates(file, source, candidates) {
  const routePatterns = [
    /(['"])(\/api\/[^'"\r\n]+)\1/g,
    /`([^`]*)`/g,
  ];

  for (const pattern of routePatterns) {
    for (const match of source.matchAll(pattern)) {
      const route = match[2] ?? match[1];
      if (!route || (!route.includes('/api/') && !route.includes('${API_BASE}'))) continue;

      const matchIndex = match.index ?? 0;
      const statementEnd = source.indexOf(');', matchIndex);
      const callSource = source.slice(matchIndex, statementEnd === -1 ? matchIndex + 500 : statementEnd);
      const methods = [...callSource.matchAll(/method\s*:\s*['"](POST|PUT|PATCH|DELETE)['"]/g)];

      if (methods.length === 0) {
        addCandidate(candidates, 'GET', route, file);
      } else {
        for (const methodMatch of methods) addCandidate(candidates, methodMatch[1], route, file);
        if (/\:\s*undefined\b/.test(callSource)) addCandidate(candidates, 'GET', route, file);
      }
    }
  }

  for (const match of source.matchAll(/postAuthRequest\(\s*['"]([^'"]+)['"]/g)) {
    addCandidate(candidates, 'POST', `/api/auth/${match[1]}`, file);
  }
}

function getDocumentedOperations(document) {
  const operations = [];
  for (const [route, pathItem] of Object.entries(document.paths ?? {})) {
    for (const method of Object.keys(pathItem)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        operations.push(`${method.toUpperCase()} ${canonicalizeRoute(route)}`);
      }
    }
  }
  return operations;
}

const document = JSON.parse(readFileSync(openApiPath, 'utf8'));
const candidates = new Map();

for (const file of collectSourceFiles(sourceRoot)) {
  collectRouteCandidates(file, readFileSync(file, 'utf8'), candidates);
}

const missing = getDocumentedOperations(document)
  .filter((operation) => !operationalOperations.has(operation))
  .filter((operation) => !candidates.has(operation));

if (missing.length > 0) {
  console.error('Product API operations without a frontend caller:');
  for (const operation of missing) console.error(`- ${operation}`);
  process.exitCode = 1;
} else {
  console.log(`API usage audit passed (${candidates.size} frontend operation candidates, ${operationalOperations.size} operational exclusions).`);
}
