# OpenNext + Wrangler on Windows can serve stale bundles when the repo lives on OneDrive.
# Copy to a local temp folder, build there, then deploy.
$ErrorActionPreference = "Stop"
$src = $PSScriptRoot + "\.."
$dest = Join-Path $env:TEMP "Smokedog-deploy"

if (Test-Path $dest) {
  Remove-Item -Recurse -Force $dest
}
New-Item -ItemType Directory -Path $dest | Out-Null

robocopy $src $dest /MIR /XD node_modules .next .open-next .git /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
if ($LASTEXITCODE -ge 8) {
  exit $LASTEXITCODE
}

Push-Location $dest
try {
  if (-not (Test-Path "node_modules")) {
    npm ci
  }
  npm run deploy:cf
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
