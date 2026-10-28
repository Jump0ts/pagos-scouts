<#
.SYNOPSIS
Descarga a este PC las copias cifradas de Pagos Scouts generadas en el servidor (por SSH). Ver ../README.md (D-62).

.DESCRIPTION
Solo anade ficheros nuevos y verifica cada descarga con SHA-256. NUNCA replica los
borrados del servidor: si alguien vacia la carpeta de backups del servidor, esta
copia sigue intacta. Aplica su propia retencion, y sale con error si el backup mas
reciente es demasiado viejo (para que el Programador de tareas lo marque como fallo).

.EXAMPLE
.\pull-backups.ps1 -Server pagos-scouts
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)][string]$Server,
    [string]$RemoteRoot = '/home/deploy/pagos-scouts/backups',
    [string]$LocalRoot = (Join-Path $env:USERPROFILE 'PagosScoutsBackups'),
    [int]$DailyKeepDays = 30,
    [int]$WeeklyKeepDays = 120,
    [int]$MaxAgeHours = 36
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'pull-backups.lib.ps1')

# BatchMode: si falta la clave SSH falla en vez de quedarse esperando una contrasena
# que nadie va a escribir cuando lo lanza el Programador de tareas.
$sshOptions = @('-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15')

function Invoke-Remote {
    param([string]$Command)
    $output = & ssh @sshOptions $Server $Command
    if ($LASTEXITCODE -ne 0) { throw "ssh fallo (codigo $LASTEXITCODE) ejecutando: $Command" }
    return $output
}

foreach ($kind in 'daily', 'weekly') {
    $remoteDir = "$RemoteRoot/$kind"
    $localDir = Join-Path $LocalRoot $kind
    New-Item -ItemType Directory -Force -Path $localDir | Out-Null

    $remoteNames = @(Invoke-Remote "ls -1 '$remoteDir'") | Where-Object { Test-BackupName $_ }

    foreach ($name in $remoteNames) {
        $target = Join-Path $localDir $name
        if (Test-Path $target) { continue }

        # scp desde la carpeta destino con ruta relativa: evita que "C:" se interprete como un host.
        Push-Location $localDir
        try {
            & scp @sshOptions "${Server}:${remoteDir}/${name}" ".\$name.partial"
            if ($LASTEXITCODE -ne 0) { throw "scp fallo (codigo $LASTEXITCODE) con $name" }
        }
        finally { Pop-Location }

        $partial = "$target.partial"
        $remoteHash = ((Invoke-Remote "sha256sum '$remoteDir/$name'") -split '\s+')[0].ToLower()
        $localHash = (Get-FileHash -Algorithm SHA256 -Path $partial).Hash.ToLower()
        if ($remoteHash -ne $localHash) {
            Remove-Item $partial
            throw "La descarga de $name esta corrupta (SHA-256 distinto)"
        }

        Move-Item $partial $target
        Write-Host "Descargado: $kind/$name"
    }

    $keepDays = if ($kind -eq 'daily') { $DailyKeepDays } else { $WeeklyKeepDays }
    $localNames = @(Get-ChildItem -Path $localDir -Filter 'pagos-scouts-*.sql.gz.age' | ForEach-Object { $_.Name })
    foreach ($expired in Get-ExpiredBackups -Names $localNames -KeepDays $keepDays -Now (Get-Date)) {
        Remove-Item (Join-Path $localDir $expired)
        Write-Host "Caducado y borrado (solo local): $kind/$expired"
    }
}

$dailyNames = @(Get-ChildItem -Path (Join-Path $LocalRoot 'daily') -Filter 'pagos-scouts-*.sql.gz.age' | ForEach-Object { $_.Name })
if (-not (Test-BackupFresh -Names $dailyNames -MaxAgeHours $MaxAgeHours -Now (Get-Date))) {
    throw "El backup diario mas reciente tiene mas de $MaxAgeHours horas (o no hay ninguno): el servidor ha dejado de generar copias."
}

Write-Host "OK: copia local al dia en $LocalRoot"
