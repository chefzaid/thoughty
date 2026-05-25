# Tasks

> Thoughty - Modern Journal Application Task Runner

## build

> 📦 Build the apps - Install dependencies for client and server

**OPTIONS**
* clean
    * flags: -c --clean
    * desc: Remove node_modules before building

```bash
set -e

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo ""
echo -e "${MAGENTA}──────────────────────────────────────────────────${NC}"
echo -e "${BOLD}  📦 THOUGHTY BUILD${NC}"
echo -e "${MAGENTA}──────────────────────────────────────────────────${NC}"
echo ""

if [ "$clean" == "true" ]; then
  echo -e "${YELLOW}🗑️  Cleaning dependencies...${NC}"
  rm -rf thoughty-server/node_modules thoughty-web/node_modules
  echo -e "${GREEN}✔${NC} Dependencies cleaned"
  echo ""
fi

echo -e "${CYAN}→${NC} Installing server dependencies..."
cd thoughty-server && npm install
echo -e "${GREEN}✔${NC} Server dependencies installed"

echo ""
cd ..

echo -e "${CYAN}→${NC} Installing client dependencies..."
cd thoughty-web && npm install
echo -e "${GREEN}✔${NC} Client dependencies installed"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${BOLD}✨ Build complete!${NC}                              ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
```

```powershell
$ErrorActionPreference = "Stop"

# Colors via Write-Host
function Write-Banner { param($text) Write-Host "`n──────────────────────────────────────────────────" -ForegroundColor Magenta; Write-Host "  📦 $text" -ForegroundColor White; Write-Host "──────────────────────────────────────────────────`n" -ForegroundColor Magenta }
function Write-Step { param($text) Write-Host "→ " -NoNewline -ForegroundColor Cyan; Write-Host $text }
function Write-Ok { param($text) Write-Host "✔ " -NoNewline -ForegroundColor Green; Write-Host $text }
function Write-Warn { param($text) Write-Host "⚠ " -NoNewline -ForegroundColor Yellow; Write-Host $text }

Write-Banner "THOUGHTY BUILD"

if ($env:clean -eq "true") {
    Write-Warn "Cleaning dependencies..."
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue thoughty-server/node_modules, thoughty-web/node_modules
    Write-Ok "Dependencies cleaned"
    Write-Host ""
}

Write-Step "Installing server dependencies..."
Set-Location thoughty-server; npm.cmd install
Write-Ok "Server dependencies installed"

Write-Host ""
Set-Location ..

Write-Step "Installing client dependencies..."
Set-Location thoughty-web; npm.cmd install
Write-Ok "Client dependencies installed"

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✨ Build complete!                              ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
```

## test

> 🧪 Run tests - Execute backend and/or frontend test suites

**OPTIONS**
* backend
    * flags: -b --backend
    * desc: Run backend tests only
* frontend
    * flags: -f --frontend
    * desc: Run frontend tests only
* coverage
    * flags: -c --coverage
    * desc: Run full coverage report

```bash
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${MAGENTA}──────────────────────────────────────────────────${NC}"
echo -e "${BOLD}  🧪 THOUGHTY TEST RUNNER${NC}"
echo -e "${MAGENTA}──────────────────────────────────────────────────${NC}"
echo ""

if [ "$coverage" == "true" ]; then
  echo -e "${CYAN}→${NC} Running full coverage report..."
  npm run coverage
  exit 0
fi

RUN_ALL=true
if [ "$backend" == "true" ] || [ "$frontend" == "true" ]; then
  RUN_ALL=false
fi

if [ "$RUN_ALL" == "true" ] || [ "$backend" == "true" ]; then
  echo -e "${CYAN}▸ BACKEND TESTS${NC}"
  echo -e "${CYAN}────────────────────────────────────────${NC}"
  cd thoughty-server
  npm test
  cd ..
  echo ""
fi

if [ "$RUN_ALL" == "true" ] || [ "$frontend" == "true" ]; then
  echo -e "${CYAN}▸ FRONTEND TESTS${NC}"
  echo -e "${CYAN}────────────────────────────────────────${NC}"
  cd thoughty-web
  npm test
  cd ..
  echo ""
fi

echo -e "${GREEN}✔${NC} All tests completed!"
```

```powershell
$ErrorActionPreference = "Stop"

function Write-Banner { param($text) Write-Host "`n──────────────────────────────────────────────────" -ForegroundColor Magenta; Write-Host "  🧪 $text" -ForegroundColor White; Write-Host "──────────────────────────────────────────────────`n" -ForegroundColor Magenta }
function Write-Section { param($text) Write-Host "`n▸ $text" -ForegroundColor Cyan; Write-Host "────────────────────────────────────────" -ForegroundColor DarkGray }
function Write-Ok { param($text) Write-Host "✔ " -NoNewline -ForegroundColor Green; Write-Host $text }

Write-Banner "THOUGHTY TEST RUNNER"

if ($env:coverage -eq "true") {
    Write-Host "→ Running full coverage report..." -ForegroundColor Cyan
  npm.cmd run coverage
    exit 0
}

$RUN_ALL = $true
if ($env:backend -eq "true" -or $env:frontend -eq "true") {
    $RUN_ALL = $false
}

if ($RUN_ALL -or $env:backend -eq "true") {
    Write-Section "BACKEND TESTS"
    Set-Location thoughty-server
  npm.cmd test
    Set-Location ..
}

if ($RUN_ALL -or $env:frontend -eq "true") {
    Write-Section "FRONTEND TESTS"
    Set-Location thoughty-web
  npm.cmd test
    Set-Location ..
}

Write-Host ""
Write-Ok "All tests completed!"
```

## run

> 🚀 Run the app - Start both thoughty-server and thoughty-web in development mode

**OPTIONS**
* kill
    * flags: -k --kill
    * desc: Kill existing node processes before running

```bash
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${MAGENTA}──────────────────────────────────────────────────${NC}"
echo -e "${BOLD}  🚀 THOUGHTY DEV SERVER${NC}"
echo -e "${MAGENTA}──────────────────────────────────────────────────${NC}"
echo ""

if [ "$kill" == "true" ]; then
  echo -e "${YELLOW}⚠${NC} Killing existing node processes..."
  npm run kill 2>/dev/null || true
  echo ""
fi

echo -e "${CYAN}→${NC} Starting database and storage..."
docker-compose -f .devcontainer/docker-compose.yml up -d db minio
echo -e "${GREEN}✔${NC} Database and MinIO started"
echo ""

# Wait for Postgres to be ready
echo -e "${CYAN}→${NC} Waiting for database to be ready..."
for i in $(seq 1 30); do
  if (cd thoughty-server && npx ts-node -r tsconfig-paths/register -e "
    const { query, closeDatabase } = require('./scripts/lib/db');
    (async () => { try { await query('SELECT 1'); await closeDatabase(); process.exit(0); } catch { await closeDatabase().catch(()=>{}); process.exit(1); } })();
  " 2>/dev/null); then
    break
  fi
  sleep 1
done
echo -e "${GREEN}✔${NC} Database is ready"
echo ""

# Apply idempotent migrations on every run so existing databases pick up new columns/indexes
echo -e "${CYAN}→${NC} Running database migrations..."
(cd thoughty-server && npm run db:migrate)
echo ""

# Seed if database is empty
NEEDS_SEED=$(cd thoughty-server && npx ts-node -r tsconfig-paths/register -e "
  const { query, closeDatabase } = require('./scripts/lib/db');
  (async () => {
    try {
      const rows = await query('SELECT COUNT(*) as count FROM users');
      await closeDatabase();
      process.stdout.write(rows[0].count === '0' ? 'yes' : 'no');
    } catch { await closeDatabase().catch(()=>{}); process.stdout.write('yes'); }
  })();
" 2>/dev/null)
if [ "$NEEDS_SEED" = "yes" ]; then
  echo -e "${YELLOW}⚠${NC} Empty database detected — seeding with test data..."
  (cd thoughty-server && npm run db:seed)
else
  echo -e "${GREEN}✔${NC} Database already has data, skipping seed"
fi
echo ""

echo -e "${CYAN}→${NC} Starting server in background..."
cd thoughty-server && npm run dev &

# Wait for server to be ready before showing URLs
sleep 4

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║${NC}  ${BOLD}🌐 Application URLs${NC}                             ${GREEN}║${NC}"
echo -e "${GREEN}╟──────────────────────────────────────────────────╢${NC}"
echo -e "${GREEN}║${NC}  Server:   ${CYAN}http://localhost:3001${NC}                 ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Swagger:  ${CYAN}http://localhost:3001/api-docs${NC}        ${GREEN}║${NC}"
echo -e "${GREEN}║${NC}  Client:   ${CYAN}http://localhost:5173${NC}                 ${GREEN}║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}→${NC} Starting client..."
cd thoughty-web && npm run dev
```

```powershell
$ErrorActionPreference = "Stop"

function Write-Banner { param($text) Write-Host "`n──────────────────────────────────────────────────" -ForegroundColor Magenta; Write-Host "  🚀 $text" -ForegroundColor White; Write-Host "──────────────────────────────────────────────────`n" -ForegroundColor Magenta }
function Write-Step { param($text) Write-Host "→ " -NoNewline -ForegroundColor Cyan; Write-Host $text }
function Write-Ok { param($text) Write-Host "✔ " -NoNewline -ForegroundColor Green; Write-Host $text }
function Write-Warn { param($text) Write-Host "⚠ " -NoNewline -ForegroundColor Yellow; Write-Host $text }

Write-Banner "THOUGHTY DEV SERVER"

if ($env:kill -eq "true") {
    Write-Warn "Killing existing node processes..."
  npm.cmd run kill 2>$null
    Write-Host ""
}

Write-Step "Starting database and storage..."
docker-compose -f .devcontainer/docker-compose.yml up -d db minio
Write-Ok "Database and MinIO started"
Write-Host ""

# Wait for Postgres to be ready
Write-Step "Waiting for database to be ready..."
for ($i = 1; $i -le 30; $i++) {
    try {
        Push-Location thoughty-server
    npx.cmd ts-node -r tsconfig-paths/register -e "const { query, closeDatabase } = require('./scripts/lib/db'); (async () => { try { await query('SELECT 1'); await closeDatabase(); process.exit(0); } catch { await closeDatabase().catch(()=>{}); process.exit(1); } })();" 2>$null
        Pop-Location
        if ($LASTEXITCODE -eq 0) { break }
    } catch {
        Pop-Location
    }
    Start-Sleep -Seconds 1
}
Write-Ok "Database is ready"
Write-Host ""

# Apply idempotent migrations on every run so existing databases pick up new columns/indexes
Write-Step "Running database migrations..."
Push-Location thoughty-server; npm.cmd run db:migrate; Pop-Location
Write-Host ""

# Seed if database is empty
Push-Location thoughty-server
$needsSeed = npx.cmd ts-node -r tsconfig-paths/register -e "const { query, closeDatabase } = require('./scripts/lib/db'); (async () => { try { const rows = await query('SELECT COUNT(*) as count FROM users'); await closeDatabase(); process.stdout.write(rows[0].count === '0' ? 'yes' : 'no'); } catch { await closeDatabase().catch(()=>{}); process.stdout.write('yes'); } })();" 2>$null
Pop-Location
if ($needsSeed -eq "yes") {
    Write-Warn "Empty database detected — seeding with test data..."
  Push-Location thoughty-server; npm.cmd run db:seed; Pop-Location
} else {
    Write-Ok "Database already has data, skipping seed"
}
Write-Host ""

Write-Step "Starting server in background..."
Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/c", "cd thoughty-server && npm.cmd run dev"

# Wait for server to be ready before showing URLs
Start-Sleep -Seconds 4

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  🌐 Application URLs                             ║" -ForegroundColor Green
Write-Host "╟──────────────────────────────────────────────────╢" -ForegroundColor Green
Write-Host "║  Server:   " -NoNewline -ForegroundColor Green; Write-Host "http://localhost:3001" -NoNewline -ForegroundColor Cyan; Write-Host "                 ║" -ForegroundColor Green
Write-Host "║  Swagger:  " -NoNewline -ForegroundColor Green; Write-Host "http://localhost:3001/api-docs" -NoNewline -ForegroundColor Cyan; Write-Host "        ║" -ForegroundColor Green
Write-Host "║  Client:   " -NoNewline -ForegroundColor Green; Write-Host "http://localhost:5173" -NoNewline -ForegroundColor Cyan; Write-Host "                 ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Write-Step "Starting client..."
Set-Location thoughty-web
npm.cmd run dev
```

## seed

> 🌱 Seed database - Fill the database with test data

```bash
set -e
echo ""
cd thoughty-server && npm run db:seed
```

```powershell
$ErrorActionPreference = "Stop"
Write-Host ""
Set-Location thoughty-server; npm.cmd run db:seed
```

## migrate

> 📋 Run migrations - Apply database schema changes

```bash
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${MAGENTA}──────────────────────────────────────────────────${NC}"
echo -e "${BOLD}  📋 DATABASE MIGRATIONS${NC}"
echo -e "${MAGENTA}──────────────────────────────────────────────────${NC}"
echo ""

echo -e "${CYAN}→${NC} Running migrations..."
cd thoughty-server && npm run db:migrate
echo ""
echo -e "${GREEN}✔${NC} Migrations completed!"
```

```powershell
$ErrorActionPreference = "Stop"

Write-Host "`n──────────────────────────────────────────────────" -ForegroundColor Magenta
Write-Host "  📋 DATABASE MIGRATIONS" -ForegroundColor White
Write-Host "──────────────────────────────────────────────────`n" -ForegroundColor Magenta

Write-Host "→ Running migrations..." -ForegroundColor Cyan
Set-Location thoughty-server; npm.cmd run db:migrate
Write-Host ""
Write-Host "✔ " -NoNewline -ForegroundColor Green; Write-Host "Migrations completed!"
```

## nuke-db

> 💣 Nuke database - Drop all tables, recreate schema, and seed with test data

**OPTIONS**
* force
    * flags: -f --force
    * desc: Skip confirmation prompt
* entries
    * flags: -e --entries
    * desc: Only delete entries (keeps users, diaries, settings)

```bash
set -e
cd thoughty-server
ARGS=""
if [ "$force" == "true" ]; then
  ARGS="$ARGS --force"
fi
if [ "$entries" == "true" ]; then
  ARGS="$ARGS --entries-only"
fi
npm run db:nuke -- $ARGS
```

```powershell
$ErrorActionPreference = "Stop"
Set-Location thoughty-server
$args = @()
if ($env:force -eq "true") {
    $args += "--force"
}
if ($env:entries -eq "true") {
    $args += "--entries-only"
}
if ($args.Count -gt 0) {
  npm.cmd run db:nuke -- @args
} else {
  npm.cmd run db:nuke
}
```

## check-db

> 🔍 Check database - Display current database state and statistics

```bash
set -e
cd thoughty-server && npm run db:check
```

```powershell
$ErrorActionPreference = "Stop"
Set-Location thoughty-server; npm.cmd run db:check
```

## kill

> ⚡ Kill processes - Terminate all running Node.js processes

```bash
cd thoughty-server && npm run kill-node
```

```powershell
Set-Location thoughty-server; npm.cmd run kill-node
```

## coverage

> 📊 Coverage report - Run full test coverage analysis

```bash
set -e
cd thoughty-server && npm run coverage-report
```

```powershell
$ErrorActionPreference = "Stop"
Set-Location thoughty-server; npm.cmd run coverage-report
```

## lint

> 🔎 Lint code - Run ESLint on thoughty-web and thoughty-server code

**OPTIONS**
* fix
    * flags: -f --fix
    * desc: Automatically fix issues where possible

```bash
set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
MAGENTA='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

echo ""
echo -e "${MAGENTA}──────────────────────────────────────────────────${NC}"
echo -e "${BOLD}  🔎 LINTING CODE${NC}"
echo -e "${MAGENTA}──────────────────────────────────────────────────${NC}"
echo ""

FIX_FLAG=""
if [ "$fix" == "true" ]; then
  FIX_FLAG="--fix"
  echo -e "${CYAN}→${NC} Auto-fix mode enabled"
fi

echo -e "${CYAN}▸ LINTING SERVER${NC}"
cd thoughty-server && npm run lint $FIX_FLAG
cd ..

echo ""
echo -e "${CYAN}▸ LINTING CLIENT${NC}"
cd thoughty-web && npx eslint . $FIX_FLAG

echo ""
echo -e "${GREEN}✔${NC} Linting completed!"
```

```powershell
$ErrorActionPreference = "Stop"

Write-Host "`n──────────────────────────────────────────────────" -ForegroundColor Magenta
Write-Host "  🔎 LINTING CODE" -ForegroundColor White
Write-Host "──────────────────────────────────────────────────`n" -ForegroundColor Magenta

$FIX_FLAG = ""
if ($env:fix -eq "true") {
    $FIX_FLAG = "--fix"
    Write-Host "→ Auto-fix mode enabled" -ForegroundColor Cyan
}

Write-Host "`n▸ LINTING SERVER" -ForegroundColor Cyan
Set-Location thoughty-server
npm.cmd run lint $FIX_FLAG
Set-Location ..

Write-Host "`n▸ LINTING CLIENT" -ForegroundColor Cyan
Set-Location thoughty-web
npx.cmd eslint . $FIX_FLAG
Set-Location ..

Write-Host ""
Write-Host "✔ " -NoNewline -ForegroundColor Green; Write-Host "Linting completed!"
```

## help

> ❓ Show help - Display available commands

```bash
echo ""
echo -e "\033[0;35m──────────────────────────────────────────────────\033[0m"
echo -e "\033[1m  ❓ THOUGHTY TASK RUNNER\033[0m"
echo -e "\033[0;35m──────────────────────────────────────────────────\033[0m"
echo ""
echo -e "\033[1mAvailable commands:\033[0m"
echo ""
echo -e "  \033[0;36mbuild\033[0m       📦 Install dependencies"
echo -e "  \033[0;36mtest\033[0m        🧪 Run tests"
echo -e "  \033[0;36mrun\033[0m         🚀 Start dev servers"
echo -e "  \033[0;36mseed\033[0m        🌱 Seed database"
echo -e "  \033[0;36mmigrate\033[0m     📋 Run migrations"
echo -e "  \033[0;36mnuke-db\033[0m     💣 Reset database completely"
echo -e "  \033[0;36mcheck-db\033[0m    🔍 Inspect database state"
echo -e "  \033[0;36mkill\033[0m        ⚡ Kill node processes"
echo -e "  \033[0;36mcoverage\033[0m    📊 Run coverage report"
echo -e "  \033[0;36mlint\033[0m        🔎 Lint code"
echo ""
echo -e "\033[1mUsage:\033[0m mask <command> [options]"
echo ""
echo -e "\033[0;90mRun 'mask <command> --help' for more info on a command\033[0m"
echo ""
```

```powershell
Write-Host "`n──────────────────────────────────────────────────" -ForegroundColor Magenta
Write-Host "  ❓ THOUGHTY TASK RUNNER" -ForegroundColor White
Write-Host "──────────────────────────────────────────────────`n" -ForegroundColor Magenta

Write-Host "Available commands:" -ForegroundColor White
Write-Host ""
Write-Host "  build       " -NoNewline -ForegroundColor Cyan; Write-Host "📦 Install dependencies"
Write-Host "  test        " -NoNewline -ForegroundColor Cyan; Write-Host "🧪 Run tests"
Write-Host "  run         " -NoNewline -ForegroundColor Cyan; Write-Host "🚀 Start dev servers"
Write-Host "  seed        " -NoNewline -ForegroundColor Cyan; Write-Host "🌱 Seed database"
Write-Host "  migrate     " -NoNewline -ForegroundColor Cyan; Write-Host "📋 Run migrations"
Write-Host "  nuke-db     " -NoNewline -ForegroundColor Cyan; Write-Host "💣 Reset database completely"
Write-Host "  check-db    " -NoNewline -ForegroundColor Cyan; Write-Host "🔍 Inspect database state"
Write-Host "  kill        " -NoNewline -ForegroundColor Cyan; Write-Host "⚡ Kill node processes"
Write-Host "  coverage    " -NoNewline -ForegroundColor Cyan; Write-Host "📊 Run coverage report"
Write-Host "  lint        " -NoNewline -ForegroundColor Cyan; Write-Host "🔎 Lint code"
Write-Host ""
Write-Host "Usage: " -NoNewline -ForegroundColor White; Write-Host "mask <command> [options]"
Write-Host ""
Write-Host "Run 'mask <command> --help' for more info on a command" -ForegroundColor DarkGray
Write-Host ""
```

