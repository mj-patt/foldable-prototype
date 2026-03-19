param(
  [string]$KeyPath = $env:TLS_KEY_PATH,
  [string]$CertPath = $env:TLS_CERT_PATH,
  [int]$Port = 3003
)

$ErrorActionPreference = "Stop"

if (-not $KeyPath -or -not $CertPath) {
  Write-Host "Missing TLS certificate paths." -ForegroundColor Yellow
  Write-Host "Provide both -KeyPath and -CertPath, or set TLS_KEY_PATH / TLS_CERT_PATH env vars." -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path -Path $KeyPath)) {
  Write-Host "TLS key not found: $KeyPath" -ForegroundColor Red
  exit 1
}

if (-not (Test-Path -Path $CertPath)) {
  Write-Host "TLS cert not found: $CertPath" -ForegroundColor Red
  exit 1
}

$env:TLS_KEY_PATH = (Resolve-Path -Path $KeyPath).Path
$env:TLS_CERT_PATH = (Resolve-Path -Path $CertPath).Path
$env:PORT = "$Port"

Write-Host "Starting Foldable server with HTTPS..." -ForegroundColor Cyan
Write-Host "TLS_KEY_PATH=$($env:TLS_KEY_PATH)" -ForegroundColor DarkGray
Write-Host "TLS_CERT_PATH=$($env:TLS_CERT_PATH)" -ForegroundColor DarkGray

node .\server.js
