<#
.SYNOPSIS
Comprueba que la copia más reciente de Pagos Scouts se restaura entera (D-62). Una vez al mes.

.DESCRIPTION
La clave privada de age solo está en este PC, así que aquí se descifra la copia y se manda por SSH a
restore-test.sh, que la carga en un Postgres desechable sin red y compara las tablas con la base real.
El volcado en claro no se escribe en ningún disco: va de age a ssh por una tubería.

.EXAMPLE
.\prueba-restauracion.ps1 -Server pagos-scouts
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Server,
    [string]$Identity = (Join-Path $env:USERPROFILE '.age\pagos-scouts.txt'),
    [string]$LocalRoot = (Join-Path $env:USERPROFILE 'PagosScoutsBackups'),
    [string]$RemoteScript = 'pagos-scouts/release/backup/restore-test.sh'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'pull-backups.lib.ps1')

if (-not (Get-Command age -ErrorAction SilentlyContinue)) { throw 'Falta age: winget install FiloSottile.age' }
if (-not (Test-Path $Identity)) { throw "No encuentro la clave privada de age en $Identity" }
if ($Server -notmatch '^[A-Za-z0-9._@-]+$') { throw "Servidor no valido: $Server" }

$latest = Get-ChildItem -Path (Join-Path $LocalRoot 'daily') -Filter 'pagos-scouts-*.sql.gz.age' |
    Where-Object { Test-BackupName $_.Name } |
    Sort-Object { Get-BackupTimestamp $_.Name } -Descending |
    Select-Object -First 1
if (-not $latest) { throw "No hay copias en $LocalRoot\daily: lanza antes pull-backups.ps1" }

Write-Host "Probando $($latest.Name)"
# PowerShell 5.1 estropea los datos binarios en las tuberías entre programas: la tubería la hace cmd.
cmd /c "age -d -i `"$Identity`" `"$($latest.FullName)`" | ssh -o BatchMode=yes $Server $RemoteScript"
if ($LASTEXITCODE -ne 0) { throw "La prueba de restauracion ha fallado (codigo $LASTEXITCODE)" }
