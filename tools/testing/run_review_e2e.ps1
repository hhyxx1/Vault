# Local Windows integration harness. Uses a separate database and ports;
# never promotes a teacher in the development/production database.
param([string[]]$Tests=@('review-flow.spec.ts','reviews.spec.ts','semantic-suite.spec.ts'),
      [string[]]$Projects=@('chromium','mobile'))
$ErrorActionPreference='Stop'
Set-Location (Resolve-Path (Join-Path $PSScriptRoot '../..'))
New-Item -ItemType Directory -Force '.pytest-tmp-svc' | Out-Null
$stateFile='.pytest-tmp-svc/review-processes.json'
if(Test-Path $stateFile){
  $owned=Get-Content $stateFile | ConvertFrom-Json
  foreach($pidToStop in @($owned.apiPid,$owned.webPid)){
    $process=Get-CimInstance Win32_Process -Filter "ProcessId=$pidToStop"
    if($process.CommandLine -match '(--port[ =]8001|--port[ =]5180)' -and
       $process.CreationDate.ToUniversalTime().ToString('o') -in @($owned.apiStarted,$owned.webStarted)){
      Stop-Process -Id $pidToStop
    }
  }
}
if(Get-NetTCPConnection -State Listen -LocalPort 8001,5180 -ErrorAction SilentlyContinue){
  throw 'Test ports 8001/5180 already occupied; do not stop unrelated services.'
}
$root=(Get-Location).Path
$pg=(docker inspect vault-development-postgres-1 | ConvertFrom-Json)[0].Config.Env
$user=($pg | Where-Object {$_ -like 'POSTGRES_USER=*'}).Substring(14)
$pass=($pg | Where-Object {$_ -like 'POSTGRES_PASSWORD=*'}).Substring(18)
$db='vault_e2e_review_takeover'
$exists=docker exec vault-development-postgres-1 psql -U $user -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'"
if($exists -ne '1'){docker exec vault-development-postgres-1 createdb -U $user $db}
$env:PYTHONPATH='services/backend/src'; $env:PYTHONUTF8='1'
$env:VAULT_DATABASE_URL="postgresql+psycopg://${user}:${pass}@127.0.0.1:5442/$db"
$env:TEMP=Join-Path $root '.pytest-tmp-svc';$env:TMP=$env:TEMP
& services/backend/.venv/Scripts/python.exe -m alembic -c services/backend/alembic.ini upgrade head
if($LASTEXITCODE){throw 'Migration failed'}
$grants=(Get-Content infra/ci_database_roles.sql -Raw).Replace('DATABASE vault_ci','DATABASE '+$db)
($grants -split "`n" | Where-Object {$_ -match '^GRANT'}) | docker exec -i vault-development-postgres-1 psql -U $user -d $db -v ON_ERROR_STOP=1 | Out-Null
$env:VAULT_ENVIRONMENT='test'
$env:VAULT_E2E_TEACHER_PASSWORD=[guid]::NewGuid().ToString()+'aA!'
& services/backend/.venv/Scripts/python.exe tools/testing/seed_review_fixture.py
if($LASTEXITCODE){throw 'Seed failed'}
$apiPassword=[regex]::Match($grants,"PASSWORD '([^']+)'").Groups[1].Value
$env:VAULT_DATABASE_URL="postgresql+psycopg://vault_api:${apiPassword}@127.0.0.1:5442/$db"
$worker=(wsl -d Ubuntu -u root -- cat /etc/vault-code-worker.env)
$tokenLine=$worker | Where-Object {$_ -match 'TOKEN='} | Select-Object -First 1
$env:VAULT_CODE_WORKER_TOKEN=($tokenLine -split '=',2)[1].Trim('"',"'")
$env:VAULT_CODE_WORKER_URL='http://127.0.0.1:8091'
$env:VAULT_AUTH_ENABLED='true';$env:VAULT_ALLOWED_ORIGINS='["http://127.0.0.1:5180","http://127.0.0.1:8001"]'
$env:VAULT_MAIL_CAPTURE_DIR=Join-Path $root '.pytest-tmp-svc/review-mail';$env:VAULT_E2E_MAIL_CAPTURE_DIR=$env:VAULT_MAIL_CAPTURE_DIR
New-Item -ItemType Directory -Force $env:VAULT_MAIL_CAPTURE_DIR | Out-Null
$python=Join-Path $root 'services/backend/.venv/Scripts/python.exe'
$api=Start-Process $python -ArgumentList '-m','uvicorn','vault_backend.api:app','--host','127.0.0.1','--port','8001','--loop','vault_backend.runtime:loop_factory' -WorkingDirectory $root -WindowStyle Hidden -PassThru -RedirectStandardOutput "$root/.pytest-tmp-svc/review-api.log" -RedirectStandardError "$root/.pytest-tmp-svc/review-api.err"
$env:VAULT_API_PROXY_TARGET='http://127.0.0.1:8001';$env:VAULT_E2E_PORT='5180';$env:PLAYWRIGHT_CHANNEL='chrome'
$node=(Get-Command node).Source
$web=Start-Process $node -ArgumentList 'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5180','--strictPort' -WorkingDirectory "$root/apps/web" -WindowStyle Hidden -PassThru -RedirectStandardOutput "$root/.pytest-tmp-svc/review-web.log" -RedirectStandardError "$root/.pytest-tmp-svc/review-web.err"
@{apiPid=$api.Id;webPid=$web.Id;apiStarted=$api.StartTime.ToUniversalTime().ToString('o');webStarted=$web.StartTime.ToUniversalTime().ToString('o')} | ConvertTo-Json | Set-Content "$root/.pytest-tmp-svc/review-processes.json"
Remove-Item Env:DEBUG -ErrorAction SilentlyContinue
$projectArgs=@($Projects | ForEach-Object { '--project='+$_ })
$ready=$false
for($attempt=0;$attempt -lt 30;$attempt++){
  try {
    $health=Invoke-RestMethod 'http://127.0.0.1:8001/api/v1/health/ready' -TimeoutSec 2
    $ready=$health.status -eq 'ready'
    if($ready){break}
  } catch {}
  Start-Sleep -Milliseconds 500
}
if(-not $ready){throw 'Isolated API did not become ready; inspect private review-api.err.'}
& npm.cmd --prefix apps/web run test:e2e -- @Tests @projectArgs --workers=1 *> "$root/.pytest-tmp-svc/review-e2e.log"
$testExit=$LASTEXITCODE
Write-Output "E2E exit: $testExit"
Get-Content "$root/.pytest-tmp-svc/review-e2e.log" -Tail 35



# Keep preview/test servers running for inspection, as requested.
exit $testExit
