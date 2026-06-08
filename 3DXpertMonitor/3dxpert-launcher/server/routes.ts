import type { Express, Request, Response } from "express";
import type { Server } from "http";
import { exec } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { storage } from "./storage";

// The GDI helper is a separate .ps1 that uses a here-string to avoid quote escaping issues
const GDI_HELPER_SCRIPT = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class GdiHelper {
    [DllImport("user32.dll")]
    public static extern int GetGuiResources(IntPtr hProcess, int uiFlags);
}
"@
param([int]$ProcessId)
$proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
if ($proc) {
    $gdi = [GdiHelper]::GetGuiResources($proc.Handle, 0)
    Write-Output $gdi
} else {
    Write-Output 0
}
`;

const SCRIPTS: Record<string, string> = {
  resources: `
$proc = Get-Process -Name "3DXpert" -ErrorAction SilentlyContinue
if (-not $proc) {
  Write-Output "3DXpert.exe is NOT running."
} else {
  $commit = [math]::Round($proc.PagedMemorySize64 / 1KB, 0)

  # GDI objects: open process handle with PROCESS_QUERY_INFORMATION rights
  $gdi = 0
  try {
    $sig = @'
using System;
using System.Runtime.InteropServices;
public class WinRes {
    [DllImport("kernel32.dll")] public static extern IntPtr OpenProcess(uint dwAccess, bool bInherit, int dwPid);
    [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);
    [DllImport("user32.dll")]   public static extern int  GetGuiResources(IntPtr hProcess, int uiFlags);
}
'@
    Add-Type -TypeDefinition $sig -Language CSharp
    $handle = [WinRes]::OpenProcess(0x0410, $false, $proc.Id)
    if ($handle -ne [IntPtr]::Zero) {
      $gdi = [WinRes]::GetGuiResources($handle, 0)
      [WinRes]::CloseHandle($handle) | Out-Null
    }
  } catch { $gdi = -1 }

  # CPU: sample over 1s
  $cpuBefore = $proc.CPU
  Start-Sleep -Milliseconds 1000
  $proc2    = Get-Process -Name "3DXpert" -ErrorAction SilentlyContinue
  $cpuAfter = if ($proc2) { $proc2.CPU } else { $cpuBefore }
  $cpuDelta = [math]::Round($cpuAfter - $cpuBefore, 4)

  Write-Output ("CPU=" + $cpuDelta)
  Write-Output ("COMMIT=" + $commit)
  Write-Output ("GDI=" + $gdi)

  # GPU Memory via nvidia-smi (total used across all processes, matches Task Manager GPU column)
  $gpuVal = "n/a"
  try {
    $smi = & nvidia-smi --query-gpu=memory.used,memory.total --format=csv,noheader,nounits 2>$null
    if ($smi) {
      $parts = ($smi -split ",") | ForEach-Object { $_.Trim() }
      $usedKB = [int]$parts[0].Trim() * 1024
      $gpuVal = $usedKB.ToString() + " K"
    }
  } catch { }
  Write-Output ("GPU=" + $gpuVal)
}
`,

  logs: (maxLines: number) => `
$logDir = "C:\\ProgramData\\Oqton\\3DXpert\\18.0\\Data\\log"
if (-not (Test-Path $logDir)) { Write-Output ("Log directory not found: " + $logDir); exit 1 }
$logFile = Get-ChildItem -Path $logDir -Filter "3DXpert*" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $logFile) { Write-Output "No 3DXpert log file found"; exit 1 }
Write-Output ("Log file: " + $logFile.Name)
Write-Output ("Last modified: " + $logFile.LastWriteTime)
Write-Output "---"
$tmp = [System.IO.Path]::GetTempFileName()
try {
  [System.IO.File]::Copy($logFile.FullName, $tmp, $true)
  $lines = [System.IO.File]::ReadAllLines($tmp)
  $lines | Select-Object -Last ${maxLines} | ForEach-Object { Write-Output $_ }
} catch {
  Write-Output ("Could not read log: " + $_.Exception.Message)
} finally {
  if (Test-Path $tmp) { Remove-Item $tmp -Force }
}
`,

};

export async function registerRoutes(httpServer: Server, app: Express) {

  // Write the GDI helper once at startup so resources script can call it
  const gdiHelperPath = join(tmpdir(), "gdi_helper.ps1");
  writeFileSync(gdiHelperPath, GDI_HELPER_SCRIPT, "utf-8");

  // Debug: returns raw resources output so you can inspect what PowerShell actually sends
  app.get("/api/debug/resources", (_req: Request, res: Response) => {
    const tmpFile = join(tmpdir(), `launcher_debug_${Date.now()}.ps1`);
    writeFileSync(tmpFile, SCRIPTS.resources, "utf-8");
    const cmd = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`;
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      try { unlinkSync(tmpFile); } catch {}
      res.json({ stdout, stderr, err: err?.message });
    });
  });

  // Debug GPU memory — shows raw counter values to compare with Task Manager
  app.get("/api/debug/gpu", (_req: Request, res: Response) => {
    const gpuScript = `
$proc = Get-Process -Name "3DXpert" -ErrorAction SilentlyContinue
if (-not $proc) { Write-Output "3DXpert NOT running"; exit }
Write-Output ("PID: " + $proc.Id)
try {
  $allPaths = (Get-Counter -ListSet "GPU Process Memory" -ErrorAction Stop).PathsWithInstances
  $dedPaths = @($allPaths | Where-Object { $_ -match $proc.Id -and $_ -match "Dedicated Usage" })
  Write-Output ("Dedicated Usage counters found: " + $dedPaths.Count)
  if ($dedPaths.Count -gt 0) {
    $samples = (Get-Counter -Counter $dedPaths -ErrorAction Stop).CounterSamples
    $totalBytes = ($samples | Measure-Object -Property CookedValue -Sum).Sum
    Write-Output ("Total bytes: " + $totalBytes)
    Write-Output ("Total MB (bytes/1MB): " + [math]::Round($totalBytes/1MB,1))
    Write-Output ("Total MB (bytes/1000000): " + [math]::Round($totalBytes/1000000,1))
    Write-Output ("Total MB (bytes/1048576): " + [math]::Round($totalBytes/1048576,1))
    foreach ($s in $samples) {
      Write-Output ("  " + $s.Path + " = " + $s.CookedValue + " bytes = " + [math]::Round($s.CookedValue/1MB,1) + " MB")
    }
  }
} catch {
  Write-Output ("Error: " + $_.Exception.Message)
}
`;
    const tmpFile = join(tmpdir(), `launcher_gpudebug_${Date.now()}.ps1`);
    writeFileSync(tmpFile, gpuScript, "utf-8");
    const cmd = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`;
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      try { unlinkSync(tmpFile); } catch {}
      res.json({ stdout, stderr, err: err?.message });
    });
  });

  // Run a named script
  // Dedicated logs route — accepts maxLines from the request body
  app.post("/api/run/logs", (req: Request, res: Response) => {
    const maxLines = Math.max(1, parseInt(req.body?.maxLines ?? "50", 10) || 50);
    const psCode = SCRIPTS.logs(maxLines);
    const tmpFile = join(tmpdir(), `launcher_logs_${Date.now()}.ps1`);
    writeFileSync(tmpFile, psCode, "utf-8");
    const cmd = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`;
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      try { unlinkSync(tmpFile); } catch {}
      const output = [stdout, stderr].filter(Boolean).join("\n").trim() ||
        (err ? `Error: ${err.message}` : "(no output)");
      const exitCode = err?.code ?? 0;
      const run = storage.saveRun({ scriptName: "logs", output, exitCode, ranAt: new Date().toISOString() });
      res.json({ id: run.id, output, exitCode });
    });
  });

  app.post("/api/run/:script", (req: Request, res: Response) => {
    const scriptKey = req.params.script as string;
    const scriptBody = req.body?.script as string | undefined;

    const entry = SCRIPTS[scriptKey as keyof typeof SCRIPTS];
    const psCode = scriptBody ?? (typeof entry === "string" ? entry : undefined);
    if (!psCode) {
      return res.status(404).json({ error: "Unknown script" });
    }

    const tmpFile = join(tmpdir(), `launcher_${Date.now()}.ps1`);
    writeFileSync(tmpFile, psCode, "utf-8");
    const cmd = `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`;

    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      try { unlinkSync(tmpFile); } catch {}
      const output = [stdout, stderr].filter(Boolean).join("\n").trim() ||
        (err ? `Error: ${err.message}` : "(no output)");
      const exitCode = err?.code ?? 0;

      const run = storage.saveRun({
        scriptName: scriptKey,
        output,
        exitCode,
        ranAt: new Date().toISOString(),
      });

      res.json({ id: run.id, output, exitCode });
    });
  });

  // Exit: close browser, kill parent cmd/shell window, stop server
  app.post("/api/exit", (_req: Request, res: Response) => {
    res.json({ ok: true });
    setTimeout(() => {
      const nodePid = process.pid;
      // Write a detached kill script that runs AFTER node exits
      const killScript =
`$target = ${nodePid}
Start-Sleep -Milliseconds 500
function Get-ParentPid($p) {
  try { return (Get-WmiObject Win32_Process -Filter "ProcessId=$p").ParentProcessId } catch { return 0 }
}
function Is-Shell($p) {
  try { $n = (Get-Process -Id $p -ErrorAction SilentlyContinue).Name; return ($n -match 'cmd|powershell|pwsh') } catch { return $false }
}
$cur = $target
for ($i = 0; $i -lt 6; $i++) {
  $par = Get-ParentPid $cur
  if (-not $par -or $par -le 4) { break }
  if (Is-Shell $par) { taskkill /PID $par /T /F 2>$null; break }
  $cur = $par
}
`;
      const tmpFile = join(tmpdir(), `launcher_exit_${Date.now()}.ps1`);
      writeFileSync(tmpFile, killScript, "utf-8");
      // Launch detached so it outlives Node.js
      exec(`cmd /c start /b "" powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "${tmpFile}"`);
      // Give the detached process a moment to start, then exit Node
      setTimeout(() => process.exit(0), 400);
    }, 200);
  });

  // Get FileVersion of 3DXpert.exe
  app.get("/api/version", (_req: Request, res: Response) => {
    const ps = `
$exePath = "C:\\Program Files\\Oqton\\3DXpert\\18.0\\Program\\3DXpert.exe"
if (Test-Path $exePath) {
  $ver = (Get-Item $exePath).VersionInfo.FileVersion
  Write-Output $ver
} else {
  Write-Output "not found"
}
`;
    const tmpFile = join(tmpdir(), `launcher_ver_${Date.now()}.ps1`);
    writeFileSync(tmpFile, ps, "utf-8");
    exec(`powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${tmpFile}"`,
      { timeout: 10000 }, (err, stdout) => {
        try { unlinkSync(tmpFile); } catch {}
        res.json({ version: (stdout || "").trim() || "unknown" });
      });
  });

  // Open Windows Explorer at various 3DXpert folders
  const openFolder = (path: string, res: Response) => {
    exec(`explorer.exe "${path}"`, () => {});
    res.json({ ok: true });
  };
  app.post("/api/open-dumps",   (_req, res) => openFolder("C:\\Windows\\Temp\\_3DXpertDumps", res));
  app.post("/api/open-data",    (_req, res) => openFolder("C:\\ProgramData\\Oqton\\3DXpert\\18.0\\Data", res));
  app.post("/api/open-program", (_req, res) => openFolder("C:\\Program Files\\Oqton\\3DXpert\\18.0\\Program", res));

  // Recent run history
  app.get("/api/history", (_req: Request, res: Response) => {
    res.json(storage.getRecentRuns(20));
  });
}
