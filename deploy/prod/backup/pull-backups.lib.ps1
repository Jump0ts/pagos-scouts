# Funciones puras de pull-backups.ps1 (separadas para poder probarlas con Pester).

$script:BackupNamePattern = '^pagos-scouts-(\d{8}-\d{6})\.sql\.gz\.age$'

# Solo se descargan o borran ficheros con exactamente este formato: asi un nombre
# raro en el servidor (p. ej. con "..") nunca puede apuntar fuera de la carpeta.
function Test-BackupName {
    param([string]$Name)
    return [bool]($Name -match $script:BackupNamePattern)
}

function Get-BackupTimestamp {
    param([string]$Name)
    if ($Name -match $script:BackupNamePattern) {
        return [datetime]::ParseExact($Matches[1], 'yyyyMMdd-HHmmss', [cultureinfo]::InvariantCulture)
    }
    throw "Nombre de backup no valido: $Name"
}

# Backups que superan la retencion. Siempre se conservan los MinKeep mas recientes,
# aunque esten caducados: si el servidor deja de generar copias, la caducidad no
# debe ir vaciando la copia local hasta quedarse sin nada.
function Get-ExpiredBackups {
    param(
        [string[]]$Names,
        [int]$KeepDays,
        [datetime]$Now,
        [int]$MinKeep = 3
    )
    $valid = @($Names | Where-Object { $_ -and (Test-BackupName $_) } |
            Sort-Object { Get-BackupTimestamp $_ } -Descending)
    $candidates = @($valid | Select-Object -Skip $MinKeep)
    return @($candidates | Where-Object { ($Now - (Get-BackupTimestamp $_)).TotalDays -gt $KeepDays })
}

function Test-BackupFresh {
    param(
        [string[]]$Names,
        [int]$MaxAgeHours,
        [datetime]$Now
    )
    $valid = @($Names | Where-Object { $_ -and (Test-BackupName $_) })
    if ($valid.Count -eq 0) { return $false }
    $newest = $valid | ForEach-Object { Get-BackupTimestamp $_ } | Sort-Object -Descending | Select-Object -First 1
    return (($Now - $newest).TotalHours -le $MaxAgeHours)
}
