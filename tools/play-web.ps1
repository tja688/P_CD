# 双击仓库根目录的 play-web.bat：安装缺的网页依赖、找空闲端口、打开默认浏览器。
# 只留这一个窗口。网页和本地内核在后台跑，关掉窗口会一起停掉。
$ErrorActionPreference = "Stop"

if (-not ("PcdPlayWin" -as [type])) {
  Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public class PcdPlayWin {
    [StructLayout(LayoutKind.Sequential)]
    struct BasicLimit {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct IoCounters {
        public ulong ReadOperationCount;
        public ulong WriteOperationCount;
        public ulong OtherOperationCount;
        public ulong ReadTransferCount;
        public ulong WriteTransferCount;
        public ulong OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct ExtendedLimit {
        public BasicLimit BasicLimitInformation;
        public IoCounters IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    delegate bool CtrlHandler(int ctrlType);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    static extern IntPtr CreateJobObject(IntPtr attributes, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr OpenProcess(uint access, bool inherit, int pid);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool CloseHandle(IntPtr handle);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool TerminateProcess(IntPtr process, uint exitCode);

    [DllImport("kernel32.dll")]
    static extern bool SetConsoleCtrlHandler(CtrlHandler handler, bool add);

    const int JobObjectExtendedLimitInformation = 9;
    const uint KillOnJobClose = 0x2000;
    static IntPtr job;
    static CtrlHandler ctrlHandler;
    static readonly System.Collections.Generic.List<object> pins = new System.Collections.Generic.List<object>();
    public static string SessionFile;

    public static void Start() {
        job = CreateJobObject(IntPtr.Zero, null);
        var info = new ExtendedLimit();
        info.BasicLimitInformation.LimitFlags = KillOnJobClose;
        int length = Marshal.SizeOf(typeof(ExtendedLimit));
        IntPtr ptr = Marshal.AllocHGlobal(length);
        try {
            Marshal.StructureToPtr(info, ptr, false);
            if (!SetInformationJobObject(job, JobObjectExtendedLimitInformation, ptr, (uint)length))
                throw new System.ComponentModel.Win32Exception(Marshal.GetLastWin32Error());
        } finally {
            Marshal.FreeHGlobal(ptr);
        }
    }

    public static void WatchClose() {
        ctrlHandler = OnCtrl;
        SetConsoleCtrlHandler(ctrlHandler, true);
    }

    static bool OnCtrl(int ctrlType) {
        if (ctrlType == 2 || ctrlType == 5 || ctrlType == 6) {
            try {
                if (!string.IsNullOrEmpty(SessionFile) && System.IO.File.Exists(SessionFile))
                    System.IO.File.Delete(SessionFile);
            } catch (Exception) {
            }
        }
        return false;
    }

    public static void AddProcess(int pid) {
        if (job == IntPtr.Zero) return;
        IntPtr proc = OpenProcess(0x0101, false, pid);
        if (proc == IntPtr.Zero) return;
        try {
            if (!AssignProcessToJobObject(job, proc)) {
                int error = Marshal.GetLastWin32Error();
                TerminateProcess(proc, 1);
                throw new System.ComponentModel.Win32Exception(error);
            }
        } finally {
            CloseHandle(proc);
        }
    }

    public static void CloseJob() {
        if (job == IntPtr.Zero) return;
        CloseHandle(job);
        job = IntPtr.Zero;
    }

    public static int RunInConsole(string file, string arguments, string workDir) {
        var psi = new System.Diagnostics.ProcessStartInfo();
        psi.FileName = file;
        psi.Arguments = arguments;
        psi.WorkingDirectory = workDir;
        psi.UseShellExecute = false;
        psi.CreateNoWindow = false;
        var proc = System.Diagnostics.Process.Start(psi);
        AddProcess(proc.Id);
        proc.WaitForExit();
        return proc.ExitCode;
    }

    public static System.Diagnostics.Process StartHidden(string file, string arguments, string workDir, string outLog, string errLog) {
        var psi = new System.Diagnostics.ProcessStartInfo();
        psi.FileName = file;
        psi.Arguments = arguments;
        psi.WorkingDirectory = workDir;
        psi.UseShellExecute = false;
        psi.CreateNoWindow = true;
        psi.RedirectStandardOutput = true;
        psi.RedirectStandardError = true;
        var proc = new System.Diagnostics.Process();
        proc.StartInfo = psi;
        proc.EnableRaisingEvents = true;
        var outs = new System.IO.StreamWriter(outLog, false);
        var errs = new System.IO.StreamWriter(errLog, false);
        outs.AutoFlush = true;
        errs.AutoFlush = true;
        pins.Add(outs);
        pins.Add(errs);
        proc.OutputDataReceived += (sender, args) => { if (args.Data != null) outs.WriteLine(args.Data); };
        proc.ErrorDataReceived += (sender, args) => { if (args.Data != null) errs.WriteLine(args.Data); };
        proc.Start();
        proc.BeginOutputReadLine();
        proc.BeginErrorReadLine();
        pins.Add(proc);
        AddProcess(proc.Id);
        return proc;
    }
}
'@
}

function Initialize-Console {
  try { & chcp.com 65001 | Out-Null } catch {}
  try {
    $utf8 = New-Object System.Text.UTF8Encoding $false
    [Console]::OutputEncoding = $utf8
    $global:OutputEncoding = $utf8
  } catch {}
  try { $Host.UI.RawUI.WindowTitle = "PCD 网页预览" } catch {}
}

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Get-ListeningPorts {
  $ports = New-Object "System.Collections.Generic.HashSet[int]"
  foreach ($endPoint in [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()) {
    [void]$ports.Add([int]$endPoint.Port)
  }
  return $ports
}

function Test-TcpFree([int]$Port) {
  $listener = $null
  try {
    $listener = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($null -ne $listener) {
      try { $listener.Stop() } catch {}
    }
  }
}

function Find-FreePort([int]$Start, [int]$Count) {
  $listening = Get-ListeningPorts
  for ($i = 0; $i -lt $Count; $i++) {
    $port = $Start + $i
    if ($listening.Contains($port)) { continue }
    if (Test-TcpFree $port) { return $port }
  }
  throw "从 $Start 起连续 $Count 个端口都被占用。"
}

function Read-HttpText([int]$Port) {
  $req = [System.Net.HttpWebRequest]::Create("http://127.0.0.1:$Port/")
  $req.Timeout = 600
  $req.ReadWriteTimeout = 600
  $req.KeepAlive = $false
  $req.UserAgent = "pcd-play-web"
  try {
    $res = $req.GetResponse()
    try {
      $reader = New-Object System.IO.StreamReader($res.GetResponseStream())
      try { return $reader.ReadToEnd() } finally { $reader.Close() }
    } finally { $res.Close() }
  } catch [System.Net.WebException] {
    $resp = $_.Exception.Response
    if ($null -eq $resp) { return $null }
    try {
      $code = [int]$resp.StatusCode
      if ($code -eq 400) { return "pcd-devhost" }
    } finally { $resp.Close() }
    return $null
  } catch {
    return $null
  }
}

function Test-WebApp([int]$Port) {
  if (-not (Get-ListeningPorts).Contains($Port)) { return $false }
  $body = Read-HttpText $Port
  if ($null -eq $body) { return $false }
  return $body.Contains("/src/main.ts")
}

function Test-DevHost([int]$Port) {
  if (-not (Get-ListeningPorts).Contains($Port)) { return $false }
  $body = Read-HttpText $Port
  return $body -eq "pcd-devhost"
}

function Find-RunningWeb([int]$Start, [int]$Count) {
  $listening = Get-ListeningPorts
  for ($i = 0; $i -lt $Count; $i++) {
    $port = $Start + $i
    if (-not $listening.Contains($port)) { continue }
    if (Test-WebApp $port) { return $port }
  }
  return 0
}

function Wait-Ready([scriptblock]$Probe, $Proc, [int]$TimeoutSec, [string]$Label) {
  $started = Get-Date
  $deadline = $started.AddSeconds($TimeoutSec)
  $nextNote = $started.AddSeconds(5)
  while ((Get-Date) -lt $deadline) {
    if ($null -ne $Proc) {
      try {
        $Proc.Refresh()
        if ($Proc.HasExited) { return "exited" }
      } catch {
        return "exited"
      }
    }
    if (& $Probe) { return "ready" }
    if ((Get-Date) -ge $nextNote) {
      $seconds = [int]((Get-Date) - $started).TotalSeconds
      Write-Host "$Label 已等待 $seconds 秒..."
      $nextNote = (Get-Date).AddSeconds(5)
    }
    Start-Sleep -Milliseconds 300
  }
  return "timeout"
}

function Format-CommandLine([string[]]$ArgumentList) {
  $parts = foreach ($item in $ArgumentList) {
    $text = [string]$item
    if ($text -match '[\s"]') { '"' + ($text -replace '"', '\"') + '"' } else { $text }
  }
  return ($parts -join " ")
}

function Invoke-Foreground([string]$FilePath, [string[]]$ArgumentList, [string]$WorkingDirectory) {
  return [PcdPlayWin]::RunInConsole($FilePath, (Format-CommandLine $ArgumentList), $WorkingDirectory)
}

function Start-Hidden([string]$FilePath, [string[]]$ArgumentList, [string]$WorkingDirectory, [string]$OutLog, [string]$ErrLog) {
  foreach ($path in @($OutLog, $ErrLog)) {
    if (Test-Path -LiteralPath $path) {
      Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
    }
  }
  return [PcdPlayWin]::StartHidden($FilePath, (Format-CommandLine $ArgumentList), $WorkingDirectory, $OutLog, $ErrLog)
}

function Stop-Tree($Proc) {
  if ($null -eq $Proc) { return }
  try {
    $Proc.Refresh()
    if ($Proc.HasExited) { return }
  } catch {
    return
  }
  & taskkill.exe /PID $Proc.Id /T /F | Out-Null
}

function Show-LogTail([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  Write-Host "---- $(Split-Path -Leaf $Path)"
  try {
    Get-Content -LiteralPath $Path -Tail 40 -ErrorAction Stop | ForEach-Object { Write-Host $_ }
  } catch {}
}

function Test-LogDenied([string[]]$Paths) {
  foreach ($path in $Paths) {
    if (-not (Test-Path -LiteralPath $path)) { continue }
    try {
      $hit = Select-String -LiteralPath $path -Pattern "访问权限|Access is denied|拒绝访问" -Quiet -ErrorAction SilentlyContinue
      if ($hit) { return $true }
    } catch {}
  }
  return $false
}

function Build-Url([int]$WebPort, [bool]$KernelReady, [int]$KernelPort, [bool]$WasmReady) {
  $base = "http://127.0.0.1:$WebPort/"
  if ($KernelReady) {
    $parts = New-Object System.Collections.Generic.List[string]
    if (-not $WasmReady) { [void]$parts.Add("kernel=ws") }
    if ($KernelPort -ne 7420) {
      $ws = [uri]::EscapeDataString("ws://127.0.0.1:$KernelPort/")
      [void]$parts.Add("ws=$ws")
    }
    if ($parts.Count -eq 0) { return $base }
    return $base + "?" + ($parts -join "&")
  }
  if (-not $WasmReady) { throw "本地内核和 WebAssembly 都没有准备好。" }
  return $base + "?kernel=wasm"
}

function Open-Browser([string]$Url) {
  Write-Host ""
  Write-Host "打开 $Url"
  Start-Process $Url
}

function Require-Command([string]$Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "找不到命令 $Name 。请先安装并加入 PATH。"
  }
}

function Get-NpmLaunch {
  $nodeDir = Split-Path -Parent (Get-Command node).Source
  $node = Join-Path $nodeDir "node.exe"
  if (-not (Test-Path -LiteralPath $node)) { $node = (Get-Command node).Source }
  $cli = Join-Path $nodeDir "node_modules\npm\bin\npm-cli.js"
  $prefixJs = Join-Path $nodeDir "node_modules\npm\bin\npm-prefix.js"
  if (Test-Path -LiteralPath $prefixJs) {
    $prefix = & $node $prefixJs
    if ($LASTEXITCODE -eq 0 -and $prefix) {
      $prefixed = Join-Path ($prefix.Trim()) "node_modules\npm\bin\npm-cli.js"
      if (Test-Path -LiteralPath $prefixed) { $cli = $prefixed }
    }
  }
  if (-not (Test-Path -LiteralPath $cli)) { throw "找不到 npm-cli.js。" }
  return @{ Node = $node; Cli = $cli }
}

function Main {
  Initialize-Console
  $logDir = Join-Path $env:TEMP "pcd-play-web"
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $session = Join-Path $logDir "session.url"

  if (Test-Path -LiteralPath $session) {
    $saved = (Get-Content -LiteralPath $session -Raw).Trim()
    if ($saved -match "^http://127\.0\.0\.1:(\d+)/") {
      $existingPort = [int]$Matches[1]
      if (Test-WebApp $existingPort) {
        Write-Host "网页已在运行。"
        Open-Browser $saved
        return
      }
    }
    Remove-Item -LiteralPath $session -Force -ErrorAction SilentlyContinue
  }

  $running = Find-RunningWeb 5173 20
  if ($running -gt 0) {
    Write-Host "网页已在运行。"
    Open-Browser "http://127.0.0.1:$running/"
    return
  }

  $root = Get-RepoRoot
  Set-Location -LiteralPath $root
  Require-Command "dotnet"
  Require-Command "node"
  $npm = Get-NpmLaunch
  [PcdPlayWin]::SessionFile = $session
  [PcdPlayWin]::Start()
  [PcdPlayWin]::WatchClose()

  $webRoot = Join-Path $root "src\Pcd.Web"
  $vitePkg = Join-Path $webRoot "node_modules\vite\package.json"
  if (-not (Test-Path -LiteralPath $vitePkg)) {
    Write-Host "正在安装网页依赖..."
    $installCode = Invoke-Foreground $npm.Node @($npm.Cli, "install") $webRoot
    if ($installCode -ne 0) { throw "npm install 失败。" }
  }

  $dotnetExe = (Get-Command dotnet).Source
  $dotnetJs = Join-Path $root "src\Pcd.Wasm\bin\Release\net10.0\browser-wasm\AppBundle\_framework\dotnet.js"
  $wasmReady = Test-Path -LiteralPath $dotnetJs
  if (-not $wasmReady) {
    Write-Host "还没有浏览器内核，开始发布 WebAssembly。第一次可能要几分钟..."
    $publishCode = Invoke-Foreground $dotnetExe @("publish", (Join-Path $root "src\Pcd.Wasm\Pcd.Wasm.csproj"), "-c", "Release", "--nologo") $root
    if ($publishCode -ne 0) {
      Write-Host "WebAssembly 发布失败。若本地内核能听上端口，网页仍可游玩。"
    }
    $wasmReady = Test-Path -LiteralPath $dotnetJs
  }

  $webProc = $null
  $devProc = $null
  $ownsKernel = $false
  try {
    $kernelPort = 7420
    $kernelReady = $false
    $devOut = Join-Path $logDir "devhost.out.log"
    $devErr = Join-Path $logDir "devhost.err.log"
    if (Test-DevHost 7420) {
      Write-Host "本地内核已在 7420 端口。"
      $kernelReady = $true
    } else {
      Write-Host "正在准备本地内核..."
      $devProj = Join-Path $root "src\Pcd.DevHost\Pcd.DevHost.csproj"
      $devExe = Join-Path $root "src\Pcd.DevHost\bin\Debug\net10.0\Pcd.DevHost.exe"
      $buildCode = Invoke-Foreground $dotnetExe @("build", $devProj, "-c", "Debug", "--nologo") $root
      if ($buildCode -ne 0 -or -not (Test-Path -LiteralPath $devExe)) { throw "本地内核编译失败。" }
      $cursor = 7420
      for ($attempt = 1; $attempt -le 2; $attempt++) {
        $kernelPort = Find-FreePort $cursor 40
        $cursor = $kernelPort + 1
        Write-Host "启动本地内核，端口 $kernelPort"
        $devProc = Start-Hidden $devExe @("$kernelPort") $root $devOut $devErr
        $ownsKernel = $true
        $status = Wait-Ready { (Get-ListeningPorts).Contains($kernelPort) } $devProc 180 "本地内核"
        if ($status -eq "ready") {
          $kernelReady = $true
          break
        }
        Show-LogTail $devOut
        Show-LogTail $devErr
        $denied = Test-LogDenied @($devOut, $devErr)
        Stop-Tree $devProc
        $devProc = $null
        $ownsKernel = $false
        if ($status -eq "timeout" -or $denied) {
          if ($denied) { Write-Host "这个端口没有监听权限，页面改用 WebAssembly。" }
          break
        }
        Write-Host "本地内核没有留在端口上，换下一个。"
      }
    }

    $webPort = 0
    $webReady = $false
    $webOut = Join-Path $logDir "vite.out.log"
    $webErr = Join-Path $logDir "vite.err.log"
    $cursor = 5173
    for ($attempt = 1; $attempt -le 8; $attempt++) {
      $webPort = Find-FreePort $cursor 40
      $cursor = $webPort + 1
      Write-Host "启动网页，端口 $webPort"
      $webProc = Start-Hidden $npm.Node @(
        $npm.Cli, "run", "dev", "--", "--host", "127.0.0.1", "--port", "$webPort", "--strictPort"
      ) $webRoot $webOut $webErr
      $status = Wait-Ready { Test-WebApp $webPort } $webProc 90 "网页"
      if ($status -eq "ready") {
        $webReady = $true
        break
      }
      Write-Host "端口 $webPort 没有打开网页。"
      Show-LogTail $webOut
      Show-LogTail $webErr
      Stop-Tree $webProc
      $webProc = $null
    }
    if (-not $webReady) { throw "网页服务没有启动。日志在 $logDir" }

    $url = Build-Url $webPort $kernelReady $kernelPort $wasmReady
    Set-Content -LiteralPath $session -Value $url -Encoding ASCII
    if ($kernelReady) {
      Write-Host "本地内核 ws://127.0.0.1:$kernelPort/"
    } else {
      Write-Host "本地内核不可用，这次用 WebAssembly。"
    }
    Open-Browser $url
    Write-Host "日志在 $logDir"
    Write-Host "关掉这个窗口就会结束服务。按 Enter 也可以。"
    Read-Host | Out-Null
    Write-Host "正在关闭..."
  } finally {
    Stop-Tree $webProc
    if ($ownsKernel) { Stop-Tree $devProc }
    [PcdPlayWin]::CloseJob()
    if (Test-Path -LiteralPath $session) {
      Remove-Item -LiteralPath $session -Force -ErrorAction SilentlyContinue
    }
  }
  Write-Host "已停止。"
  Start-Sleep -Seconds 1
}

try {
  Main
} catch {
  Write-Host ""
  Write-Host ("启动失败：" + $_.Exception.Message)
  Read-Host "按 Enter 关闭" | Out-Null
  exit 1
}
