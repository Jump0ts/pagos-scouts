# Pruebas con Pester (incluido en Windows PowerShell 5.1):
#   Invoke-Pester deploy/prod/backup/pull-backups.Tests.ps1
. "$PSScriptRoot\pull-backups.lib.ps1"

Describe 'Test-BackupName' {
    It 'acepta un nombre generado por backup.sh' {
        Test-BackupName 'pagos-scouts-20261013-031500.sql.gz.age' | Should Be $true
    }

    It 'rechaza rutas, nombres a medias y ficheros parciales' {
        Test-BackupName '..\..\pagos-scouts-20261013-031500.sql.gz.age' | Should Be $false
        Test-BackupName 'pagos-scouts-20261013-031500.sql.gz.age.partial' | Should Be $false
        Test-BackupName 'pagos-scouts-20261013.sql.gz.age' | Should Be $false
        Test-BackupName 'otro-fichero.txt' | Should Be $false
        Test-BackupName '' | Should Be $false
    }
}

Describe 'Get-BackupTimestamp' {
    It 'lee la fecha y la hora del nombre' {
        $date = Get-BackupTimestamp 'pagos-scouts-20261013-031500.sql.gz.age'
        $date | Should Be ([datetime]'2026-10-13 03:15:00')
    }

    It 'falla con un nombre no valido' {
        { Get-BackupTimestamp 'cualquier-cosa.sql.gz.age' } | Should Throw
    }
}

Describe 'Get-ExpiredBackups' {
    $now = [datetime]'2026-10-20 12:00:00'
    $names = @(
        'pagos-scouts-20261019-031500.sql.gz.age',
        'pagos-scouts-20261018-031500.sql.gz.age',
        'pagos-scouts-20261017-031500.sql.gz.age',
        'pagos-scouts-20261001-031500.sql.gz.age',
        'pagos-scouts-20260920-031500.sql.gz.age'
    )

    It 'devuelve solo los que superan la retencion' {
        $expired = Get-ExpiredBackups -Names $names -KeepDays 14 -Now $now
        ($expired -join ',') | Should Be 'pagos-scouts-20261001-031500.sql.gz.age,pagos-scouts-20260920-031500.sql.gz.age'
    }

    It 'no devuelve nada si todo es reciente' {
        @(Get-ExpiredBackups -Names $names -KeepDays 60 -Now $now).Count | Should Be 0
    }

    It 'conserva siempre los MinKeep mas recientes aunque esten caducados' {
        $expired = Get-ExpiredBackups -Names $names -KeepDays 0 -Now $now -MinKeep 3
        ($expired -join ',') | Should Be 'pagos-scouts-20261001-031500.sql.gz.age,pagos-scouts-20260920-031500.sql.gz.age'
    }

    It 'no borra nada si hay MinKeep copias o menos' {
        $few = @('pagos-scouts-20250101-031500.sql.gz.age', 'pagos-scouts-20250102-031500.sql.gz.age')
        @(Get-ExpiredBackups -Names $few -KeepDays 1 -Now $now -MinKeep 3).Count | Should Be 0
    }

    It 'nunca devuelve ficheros que no sean backups' {
        $mixed = @('notas-personales.txt', 'pagos-scouts-20200101-031500.sql.gz.age.partial') + $names
        $expired = Get-ExpiredBackups -Names $mixed -KeepDays 14 -Now $now
        $expired -contains 'notas-personales.txt' | Should Be $false
        $expired -contains 'pagos-scouts-20200101-031500.sql.gz.age.partial' | Should Be $false
    }
}

Describe 'pull-backups.ps1 (con ssh y scp simulados)' {
    $script = Join-Path $PSScriptRoot 'pull-backups.ps1'

    BeforeEach {
        $global:FakeRemote = Join-Path ([IO.Path]::GetTempPath()) ("remote-" + [guid]::NewGuid())
        $global:FakeCorrupt = $false
        $global:LocalRoot = Join-Path ([IO.Path]::GetTempPath()) ("local-" + [guid]::NewGuid())
        foreach ($kind in 'daily', 'weekly') {
            New-Item -ItemType Directory -Force -Path "$global:FakeRemote\$kind" | Out-Null
        }

        function global:Resolve-FakePath([string]$remotePath) {
            return $remotePath.Replace('/home/deploy/pagos-scouts/backups', $global:FakeRemote).Replace('/', '\')
        }
        function global:ssh {
            $command = $args[-1]
            $global:LASTEXITCODE = 0
            if ($command -match "^ls -1 '(.+)'$") {
                Get-ChildItem (Resolve-FakePath $Matches[1]) -Name
            }
            elseif ($command -match "^sha256sum '(.+)'$") {
                $file = Resolve-FakePath $Matches[1]
                "$((Get-FileHash -Algorithm SHA256 $file).Hash.ToLower())  $file"
            }
        }
        function global:scp {
            $global:LASTEXITCODE = 0
            $source = Resolve-FakePath (($args[-2] -split ':', 2)[1])
            if ($global:FakeCorrupt) { Set-Content -Path $args[-1] -Value 'contenido distinto' } else { Copy-Item $source $args[-1] }
        }
    }

    AfterEach {
        Remove-Item function:global:ssh, function:global:scp, function:global:Resolve-FakePath -ErrorAction SilentlyContinue
        Remove-Item -Recurse -Force $global:FakeRemote, $global:LocalRoot -ErrorAction SilentlyContinue
    }

    function New-RemoteBackup([string]$kind, [datetime]$when, [string]$content = 'volcado') {
        $name = "pagos-scouts-$($when.ToString('yyyyMMdd-HHmmss')).sql.gz.age"
        Set-Content -Path "$global:FakeRemote\$kind\$name" -Value $content
        return $name
    }

    It 'descarga los backups nuevos y no repite los que ya tiene' {
        $name = New-RemoteBackup 'daily' (Get-Date)

        & $script -Server 'usuario@servidor' -LocalRoot $global:LocalRoot
        Test-Path "$global:LocalRoot\daily\$name" | Should Be $true

        # Segunda ejecucion: no hay nada nuevo y no falla.
        & $script -Server 'usuario@servidor' -LocalRoot $global:LocalRoot
        @(Get-ChildItem "$global:LocalRoot\daily").Count | Should Be 1
    }

    It 'no borra la copia local aunque se vacie la carpeta del servidor' {
        $name = New-RemoteBackup 'daily' (Get-Date)
        & $script -Server 'usuario@servidor' -LocalRoot $global:LocalRoot

        Remove-Item "$global:FakeRemote\daily\$name"

        # Sin backups nuevos en el servidor la comprobacion de antiguedad no falla
        # mientras la copia local siga siendo reciente.
        & $script -Server 'usuario@servidor' -LocalRoot $global:LocalRoot
        Test-Path "$global:LocalRoot\daily\$name" | Should Be $true
    }

    It 'falla si el backup mas reciente es demasiado viejo' {
        New-RemoteBackup 'daily' (Get-Date).AddDays(-5) | Out-Null

        { & $script -Server 'usuario@servidor' -LocalRoot $global:LocalRoot } | Should Throw 'ha dejado de generar copias'
    }

    It 'rechaza una descarga corrupta y no deja el fichero final' {
        $name = New-RemoteBackup 'daily' (Get-Date)
        $global:FakeCorrupt = $true

        { & $script -Server 'usuario@servidor' -LocalRoot $global:LocalRoot } | Should Throw 'SHA-256'
        Test-Path "$global:LocalRoot\daily\$name" | Should Be $false
        Test-Path "$global:LocalRoot\daily\$name.partial" | Should Be $false
    }
}

Describe 'Test-BackupFresh' {
    $now = [datetime]'2026-10-20 12:00:00'

    It 'es true si el mas reciente entra en el margen' {
        Test-BackupFresh -Names @('pagos-scouts-20261020-031500.sql.gz.age') -MaxAgeHours 36 -Now $now | Should Be $true
    }

    It 'es false si el mas reciente es mas viejo que el margen' {
        Test-BackupFresh -Names @('pagos-scouts-20261017-031500.sql.gz.age') -MaxAgeHours 36 -Now $now | Should Be $false
    }

    It 'es false si no hay ningun backup' {
        Test-BackupFresh -Names @() -MaxAgeHours 36 -Now $now | Should Be $false
    }
}

