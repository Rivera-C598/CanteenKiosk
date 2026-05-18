$src = "$PSScriptRoot\prisma\dev.db"
$dir = "$PSScriptRoot\backups"
$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm"
$dst = "$dir\dev_$stamp.db"

if (-not (Test-Path $src)) { Write-Error "dev.db not found at $src"; exit 1 }
if (-not (Test-Path $dir)) { New-Item -ItemType Directory $dir | Out-Null }

Copy-Item $src $dst
Write-Host "Backed up to $dst"

# Keep only last 14 backups (2 weeks of daily backups)
Get-ChildItem $dir -Filter "*.db" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 14 |
  Remove-Item -Force
