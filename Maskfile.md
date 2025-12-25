# Tasks

## build

> Build the apps

**OPTIONS**
* clean
    * flags: -c --clean
    * desc: Remove node_modules before building

```bash
set -e
if [ "$clean" == "true" ]; then
  echo "Cleaning dependencies..."
  rm -rf server/node_modules client/node_modules
fi
echo "Installing dependencies..."
cd server && npm install
cd ..
cd client && npm install
```

```powershell
$ErrorActionPreference = "Stop"
if ($env:clean -eq "true") {
  Write-Output "Cleaning dependencies..."
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue server/node_modules, client/node_modules
}
Write-Output "Installing dependencies..."
Set-Location server; npm install
Set-Location ..
Set-Location client; npm install
```

## test

> Run tests

**OPTIONS**
* backend
    * flags: -b --backend
    * desc: Run backend tests
* frontend
    * flags: -f --frontend
    * desc: Run frontend tests
* coverage
    * flags: -c --coverage
    * desc: Run coverage

```bash
set -e
if [ "$coverage" == "true" ]; then
  echo "Running coverage report..."
  npm run coverage
  exit 0
fi

RUN_ALL=true
if [ "$backend" == "true" ] || [ "$frontend" == "true" ]; then
  RUN_ALL=false
fi

if [ "$RUN_ALL" == "true" ] || [ "$backend" == "true" ]; then
  echo "Running backend tests..."
  cd server
  npm test
  cd ..
fi

if [ "$RUN_ALL" == "true" ] || [ "$frontend" == "true" ]; then
  echo "Running frontend tests..."
  cd client
  npm test
  cd ..
fi
```

```powershell
$ErrorActionPreference = "Stop"
if ($env:coverage -eq "true") {
  Write-Output "Running coverage report..."
  npm run coverage
  exit 0
}

$RUN_ALL = $true
if ($env:backend -eq "true" -or $env:frontend -eq "true") {
  $RUN_ALL = $false
}

if ($RUN_ALL -or $env:backend -eq "true") {
  Write-Output "Running backend tests..."
  Set-Location server
  npm test
  Set-Location ..
}

if ($RUN_ALL -or $env:frontend -eq "true") {
  Write-Output "Running frontend tests..."
  Set-Location client
  npm test
  Set-Location ..
}
```

## run

> Run the whole app (back and front)

**OPTIONS**
* kill
    * flags: -k --kill
    * desc: Kill node processes before running

```bash
set -e
if [ "$kill" == "true" ]; then
  echo "Killing node processes..."
  npm run kill
fi

echo "Starting database..."
docker-compose -f .devcontainer/docker-compose.yml up -d db

echo "Starting server..."
cd server && npm run dev &

echo ""
echo "========================================"
echo "  Server:  http://localhost:3001"
echo "  Swagger: http://localhost:3001/api-docs"
echo "  Client:  http://localhost:5173"
echo "========================================"
echo ""

echo "Starting client..."
cd client && npm run dev
```

```powershell
$ErrorActionPreference = "Stop"
if ($env:kill -eq "true") {
  Write-Output "Killing node processes..."
  npm run kill
}

Write-Output "Starting database..."
docker-compose -f .devcontainer/docker-compose.yml up -d db

Write-Output "Starting server..."
Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/c", "cd server && npm run dev"

Write-Output ""
Write-Output "========================================"
Write-Output "  Server:  http://localhost:3001"
Write-Output "  Swagger: http://localhost:3001/api-docs"
Write-Output "  Client:  http://localhost:5173"
Write-Output "========================================"
Write-Output ""

Write-Output "Starting client..."
Set-Location client
npm run dev
```

## seed

> Fill the db with test data

```bash
set -e
echo "Seeding database..."
npm run seed
```

```powershell
$ErrorActionPreference = "Stop"
Write-Output "Seeding database..."
npm run seed
```
