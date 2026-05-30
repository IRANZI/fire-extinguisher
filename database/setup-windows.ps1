param(
  [string]$Password = "user"
)

$ErrorActionPreference = "Stop"
$psql = Get-ChildItem "C:\Program Files\PostgreSQL" -Directory |
  ForEach-Object { Get-Item (Join-Path $_.FullName "bin\psql.exe") -ErrorAction SilentlyContinue } |
  Sort-Object FullName -Descending |
  Select-Object -First 1

if (-not $psql) {
  throw "PostgreSQL psql.exe was not found. Install PostgreSQL for Windows first."
}

$previousPassword = $env:PGPASSWORD
$env:PGPASSWORD = $Password

try {
  & $psql.FullName -v ON_ERROR_STOP=1 -h localhost -p 5432 -U postgres -d postgres -f "$PSScriptRoot\init.sql"
  if ($LASTEXITCODE -ne 0) {
    throw "Database setup failed. Check that PostgreSQL is running and the postgres password is correct."
  }
  Write-Host "SafeHub databases are ready." -ForegroundColor Green
} finally {
  $env:PGPASSWORD = $previousPassword
}
