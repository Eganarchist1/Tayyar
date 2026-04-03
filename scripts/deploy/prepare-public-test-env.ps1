param(
  [string]$ServerIp,
  [string]$PostgresPassword,
  [string]$JwtSecret
)

$ErrorActionPreference = "Stop"

function New-RandomSecret([int]$length = 48) {
  $chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_^&*"
  -join (1..$length | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
}

function Ensure-Value([string]$value, [string]$name, [scriptblock]$generator = $null) {
  if ($value -and $value.Trim()) {
    return $value.Trim()
  }

  if ($generator) {
    return & $generator
  }

  $prompted = Read-Host $name
  if (-not $prompted.Trim()) {
    throw "Missing required value: $name"
  }
  return $prompted.Trim()
}

$repoRoot = "E:\Anti Gravity\Tayyar"
$infraEnvPath = Join-Path $repoRoot "infra\.env.public-test"
$apiEnvPath = Join-Path $repoRoot "apps\api\.env.production"
$webEnvPath = Join-Path $repoRoot "apps\web\.env.production"
$heroEnvPath = Join-Path $repoRoot "apps\hero-app\.env.production"

$ServerIp = Ensure-Value $ServerIp "SERVER_IP"
$PostgresPassword = Ensure-Value $PostgresPassword "POSTGRES_PASSWORD" { New-RandomSecret 24 }
$JwtSecret = Ensure-Value $JwtSecret "JWT_SECRET" { New-RandomSecret 64 }

$postgresDb = "tayyar"
$postgresUser = "tayyar"
$databaseUrl = "postgresql://${postgresUser}:${PostgresPassword}@postgres:5432/${postgresDb}?schema=public"
$redisUrl = "redis://redis:6379"
$publicApiUrl = "http://${ServerIp}:3001"
$publicAppUrl = "http://${ServerIp}:3000"

$infraEnv = @"
POSTGRES_DB=${postgresDb}
POSTGRES_USER=${postgresUser}
POSTGRES_PASSWORD=${PostgresPassword}

DATABASE_URL=${databaseUrl}
REDIS_URL=${redisUrl}
JWT_SECRET=${JwtSecret}

NEXT_PUBLIC_API_URL=${publicApiUrl}
APP_BASE_URL=${publicAppUrl}

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=no-reply@test.local

OTP_DELIVERY_MODE=CONSOLE
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=

MAPBOX_ACCESS_TOKEN=
"@

$apiEnv = @"
NODE_ENV=production
PORT=3001
DATABASE_URL=${databaseUrl}
JWT_SECRET=${JwtSecret}
REDIS_URL=${redisUrl}
ALLOW_DEV_AUTH=false

APP_BASE_URL=${publicAppUrl}
MAPBOX_ACCESS_TOKEN=

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=no-reply@test.local

OTP_DELIVERY_MODE=CONSOLE
WHATSAPP_API_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
"@

$webEnv = @"
NEXT_PUBLIC_API_URL=${publicApiUrl}
"@

$heroEnv = @"
EXPO_PUBLIC_API_URL=${publicApiUrl}
"@

Set-Content -Path $infraEnvPath -Value $infraEnv -Encoding UTF8
Set-Content -Path $apiEnvPath -Value $apiEnv -Encoding UTF8
Set-Content -Path $webEnvPath -Value $webEnv -Encoding UTF8
Set-Content -Path $heroEnvPath -Value $heroEnv -Encoding UTF8

Write-Host ""
Write-Host "Created:"
Write-Host " - $infraEnvPath"
Write-Host " - $apiEnvPath"
Write-Host " - $webEnvPath"
Write-Host " - $heroEnvPath"
Write-Host ""
Write-Host "Public test URLs:"
Write-Host " - Web: $publicAppUrl"
Write-Host " - API: $publicApiUrl"
Write-Host ""
Write-Host "Next:"
Write-Host "1. Copy infra/.env.public-test to the VM as .env"
Write-Host "2. Run docker compose -f infra/docker-compose.public-test.yml up -d"
