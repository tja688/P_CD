#Requires -Version 5.1
$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Project = Join-Path $RepoRoot 'src\Pcd.DevHost\Pcd.DevHost.csproj'
$PortStart = 5180
$PortTryCount = 32
$ListenTimeoutSec = 120

function Get-AvailablePort {
    param(
        [int] $Start,
        [int] $Count
    )

    for ($port = $Start; $port -lt ($Start + $Count); $port++) {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
        try {
            $listener.Start()
            $listener.Stop()
            return $port
        }
        catch [System.Net.Sockets.SocketException] {
            continue
        }
        finally {
            if ($null -ne $listener -and $listener.Server.IsBound) {
                $listener.Stop()
            }
        }
    }

    $last = $Start + $Count - 1
    throw ('No free TCP port between {0} and {1}.' -f $Start, $last)
}

function Wait-LocalPort {
    param(
        [int] $Port,
        [int] $TimeoutSec
    )

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSec)
    while ([DateTime]::UtcNow -lt $deadline) {
        try {
            $client = [System.Net.Sockets.TcpClient]::new()
            $client.Connect('127.0.0.1', $Port)
            $client.Close()
            return
        }
        catch {
            Start-Sleep -Milliseconds 250
        }
    }

    throw ('Timed out waiting for http://127.0.0.1:{0}/ ({1}s).' -f $Port, $TimeoutSec)
}

function Stop-RepoDevHostProcesses {
    param(
        [string] $RepoRoot
    )

    $devHostDir = Join-Path $RepoRoot 'src\Pcd.DevHost'
    $stopped = 0

    Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object {
            ($_.Name -eq 'Pcd.DevHost.exe') -and
            $_.ExecutablePath -and
            ($_.ExecutablePath.StartsWith($devHostDir, [System.StringComparison]::OrdinalIgnoreCase))
        } |
        ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            $stopped++
        }

    Get-CimInstance Win32_Process -Filter "Name='dotnet.exe'" -ErrorAction SilentlyContinue |
        Where-Object {
            $_.CommandLine -and
            ($_.CommandLine -like ('*' + $Project + '*'))
        } |
        ForEach-Object {
            Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
            $stopped++
        }

    if ($stopped -gt 0) {
        Write-Host ('已结束 {0} 个旧的 DevHost 进程，避免内核 DLL 被占用。' -f $stopped)
        Start-Sleep -Milliseconds 500
    }
}

if (-not (Test-Path -LiteralPath $Project)) {
    throw ('DevHost project not found: {0}' -f $Project)
}

Stop-RepoDevHostProcesses -RepoRoot $RepoRoot

$build = Start-Process -FilePath 'dotnet' `
    -ArgumentList @('build', $Project, '--nologo', '-v', 'q') `
    -WorkingDirectory $RepoRoot `
    -Wait -PassThru -NoNewWindow
if ($build.ExitCode -ne 0) {
    throw ('DevHost 编译失败，错误码 {0}。' -f $build.ExitCode)
}

$port = Get-AvailablePort -Start $PortStart -Count $PortTryCount
$url = 'http://127.0.0.1:{0}/' -f $port

Write-Host ''
Write-Host 'PCD 网页试玩'
Write-Host ('端口: {0}' -f $port)
Write-Host ('地址: {0}' -f $url)
Write-Host '关闭本窗口即停止服务。'
Write-Host ''

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'dotnet'
$psi.Arguments = ('run --project "{0}" --no-build --urls "{1}"' -f $Project, $url)
$psi.WorkingDirectory = $RepoRoot
$psi.UseShellExecute = $false

$hostProcess = [System.Diagnostics.Process]::Start($psi)
if (-not $hostProcess) {
    throw 'Failed to start dotnet. Install the .NET SDK and ensure dotnet is on PATH.'
}

try {
    Wait-LocalPort -Port $port -TimeoutSec $ListenTimeoutSec
    Start-Process -FilePath $url | Out-Null
    $hostProcess.WaitForExit()
    exit $hostProcess.ExitCode
}
finally {
    if (-not $hostProcess.HasExited) {
        try { $hostProcess.Kill() } catch { }
    }
}
