# Start a development preview without stopping existing services or seeding people.
param([int]$ApiPort=8007,[int]$WebPort=5186)
$ErrorActionPreference='Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '../..'))
if(Get-NetTCPConnection -State Listen -LocalPort $ApiPort,$WebPort -ErrorAction SilentlyContinue){throw 'Preview ports are occupied; select free ports.'}
$workspace=(Get-Location).Path
New-Item -ItemType Directory -Force '.pytest-tmp-svc/dev-mail' | Out-Null
$settings=(docker inspect vault-development-postgres-1 | ConvertFrom-Json)[0].Config.Env
$owner=($settings | Where-Object {$_ -like 'POSTGRES_USER=*'}).Substring(14)
$password=($settings | Where-Object {$_ -like 'POSTGRES_PASSWORD=*'}).Substring(18)
$env:PYTHONPATH='services/backend/src';$env:PYTHONUTF8='1'
$env:TEMP=Join-Path $workspace '.pytest-tmp-svc';$env:TMP=$env:TEMP
$env:VAULT_DATABASE_URL="postgresql+psycopg://${owner}:${password}@127.0.0.1:5442/vault_dev"
& services/backend/.venv/Scripts/python.exe -m alembic -c services/backend/alembic.ini upgrade head
if($LASTEXITCODE){throw 'Development migration failed'}
$roles=(Get-Content infra/ci_database_roles.sql -Raw).Replace('DATABASE vault_ci','DATABASE vault_dev')
($roles -split "`n" | Where-Object {$_ -match '^GRANT'}) | docker exec -i vault-development-postgres-1 psql -U $owner -d vault_dev -v ON_ERROR_STOP=1 | Out-Null
if($LASTEXITCODE){throw 'Development runtime grants failed'}
$runtimePassword=[regex]::Match($roles,"PASSWORD '([^']+)'").Groups[1].Value
$env:VAULT_DATABASE_URL="postgresql+psycopg://vault_api:${runtimePassword}@127.0.0.1:5442/vault_dev"
$workerSettings=wsl -d Ubuntu -u root -- cat /etc/vault-code-worker.env
$env:VAULT_CODE_WORKER_TOKEN=((($workerSettings | Where-Object {$_ -match 'TOKEN='} | Select-Object -First 1) -split '=',2)[1]).Trim('"',"'")
$env:VAULT_CODE_WORKER_URL='http://127.0.0.1:8091'
$env:VAULT_ENVIRONMENT='development';$env:VAULT_AUTH_ENABLED='true';$env:VAULT_PORT=[string]$ApiPort
$origins=@("http://127.0.0.1:$WebPort","http://localhost:$WebPort","http://127.0.0.1:$ApiPort","http://127.0.0.1:5176","http://localhost:5176","http://127.0.0.1:5173","http://localhost:5173")
$env:VAULT_ALLOWED_ORIGINS=ConvertTo-Json -Compress $origins
$env:VAULT_MAIL_CAPTURE_DIR=Join-Path $workspace '.pytest-tmp-svc/dev-mail'
Remove-Item Env:DEBUG -ErrorAction SilentlyContinue
$python=Join-Path $workspace 'services/backend/.venv/Scripts/python.exe'
$api=Start-Process $python -ArgumentList '-m','vault_backend' -WorkingDirectory $workspace -WindowStyle Hidden -PassThru -RedirectStandardOutput "$workspace/.pytest-tmp-svc/dev-$ApiPort.log" -RedirectStandardError "$workspace/.pytest-tmp-svc/dev-$ApiPort.err"
$env:VAULT_API_PROXY_TARGET="http://127.0.0.1:$ApiPort"
$webPortText=$WebPort.ToString()
$web=Start-Process (Get-Command node).Source -ArgumentList 'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',$webPortText,'--strictPort' -WorkingDirectory "$workspace/apps/web" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$workspace/.pytest-tmp-svc/dev-$WebPort.log" -RedirectStandardError "$workspace/.pytest-tmp-svc/dev-$WebPort.err"
for($attempt=0;$attempt -lt 30;$attempt++){
  try{$ready=Invoke-RestMethod "http://127.0.0.1:$ApiPort/api/v1/health/ready" -TimeoutSec 2;if($ready.status -eq 'ready' -and (Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$WebPort/" -TimeoutSec 2).StatusCode -eq 200){@{api_port=$ApiPort;web_port=$WebPort} | ConvertTo-Json | Set-Content -Encoding utf8 '.pytest-tmp-svc/active-preview.json';Write-Output "Preview ready: http://127.0.0.1:$WebPort/ (API $ApiPort, vault_dev; no teacher fixtures)";exit 0}}catch{}
  Start-Sleep -Milliseconds 500
}
throw 'Preview did not become ready; inspect private .pytest-tmp-svc development logs.'
