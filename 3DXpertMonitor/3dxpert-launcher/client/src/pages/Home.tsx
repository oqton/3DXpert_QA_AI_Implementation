import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  Activity, Clock,
  CheckCircle2, XCircle,
  Sun, Moon, ChevronDown, ChevronUp,
  Square, Cpu, FileText, Trash2, Play, FolderOpen, PowerOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { ScriptRun } from "@shared/schema";

// One row of resource data
interface ResourceRow {
  time: string;
  commit: string;
  gdi: string;
  gpu: string;
  cpuActive: boolean;
}

// ── Mini sparkline chart (pure Canvas 2D, no deps) ──────────────────────────
const CHART_WINDOW = 60; // max data points shown

interface SparkSeries {
  label: string;
  color: string;   // CSS colour string
  values: number[];
}

function SparkChart({ series, height = 80 }: { series: SparkSeries[]; height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas to its CSS size for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    // Shared x-axis: length = longest series (capped at CHART_WINDOW)
    const n = Math.min(CHART_WINDOW, Math.max(...series.map(s => s.values.length)));
    if (n < 2) return;

    const padL = 2, padR = 2, padT = 6, padB = 4;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // Draw each series independently (each scaled to its own min/max)
    series.forEach(({ color, values }) => {
      const pts = values.slice(-n);
      if (pts.length < 2) return;
      const lo = Math.min(...pts);
      const hi = Math.max(...pts);
      const range = hi - lo || 1;

      const toX = (i: number) => padL + (i / (pts.length - 1)) * plotW;
      const toY = (v: number) => padT + plotH - ((v - lo) / range) * plotH;

      // Fill area
      ctx.beginPath();
      ctx.moveTo(toX(0), h);
      pts.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
      ctx.lineTo(toX(pts.length - 1), h);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, padT, 0, h);
      grad.addColorStop(0, color + "40");
      grad.addColorStop(1, color + "00");
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      ctx.beginPath();
      pts.forEach((v, i) => i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v)));
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = "round";
      ctx.stroke();

      // Last-value dot
      const lastX = toX(pts.length - 1);
      const lastY = toY(pts[pts.length - 1]);
      ctx.beginPath();
      ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });

    // Subtle zero-line / base line
    ctx.beginPath();
    ctx.moveTo(padL, h - padB);
    ctx.lineTo(w - padR, h - padB);
    ctx.strokeStyle = "rgba(128,128,128,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [series, height]);

  return <canvas ref={canvasRef} style={{ width: "100%", height }} />;
}

// Convert a ResourceRow field value to number (returns NaN if unparseable)
function toNum(v: string): number {
  const n = parseFloat(v.replace(/,/g, ""));
  return isNaN(n) ? NaN : n;
}

// Parse KEY=VALUE lines from PowerShell output
// Returns null if not running, or { row, active } where active = CPU > 0
function parseResourceOutput(raw: string): { row: ResourceRow; active: boolean } | null {
  if (raw.includes("NOT running")) return null;
  // Normalise Windows \r\n to \n
  const normalised = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const get = (key: string) => {
    const m = normalised.match(new RegExp("^" + key + "=(.+)$", "m"));
    return m ? m[1].trim() : "—";
  };
  const cpuVal = parseFloat(get("CPU")) || 0;
  return {
    active: true,
    row: {
      time:      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }),
      commit:    get("COMMIT"),
      gdi:       get("GDI"),
      gpu:       get("GPU").replace(/[\[\]]/g, "").replace(/\s*K$/, "").replace(/\s*MB$/, "") || "n/a",
      cpuActive: cpuVal > 0,
    },
  };
}

const INTERVAL_OPTIONS  = [2, 5, 10, 30];    // seconds
const AUTOSTOP_OPTIONS  = [2, 5, 10, 30];    // minutes
const MAX_ROWS_OPTIONS  = [10, 50, 100, 200]; // rows

export default function Home() {
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
  );

  // Resources: time-series table rows
  const [resRows, setResRows]         = useState<ResourceRow[]>([]);
  const [resStatus, setResStatus]     = useState<"idle" | "running" | "stopped">("idle");
  const [notRunning, setNotRunning]   = useState(false);

  // Logs
  const [logsOutput, setLogsOutput]   = useState("");

  // Combined monitor
  const [monitorActive, setMonitorActive] = useState(false);
  const monitorResRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const monitorLogsRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const tableBottomRef = useRef<HTMLDivElement | null>(null);

  const [activeSection, setActiveSection]   = useState<"monitor" | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(5);  // seconds
  const [autoStopMin, setAutoStopMin]         = useState(5);   // minutes
  const [maxRows, setMaxRows]                  = useState(50);  // max lines shown

  // History
  const [showHistory, setShowHistory] = useState(false);
  const qc = useQueryClient();
  const { toast } = useToast();

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
  }

  const { data: history = [] } = useQuery<ScriptRun[]>({
    queryKey: ["/api/history"],
    enabled: showHistory,
  });

  // Fetch 3DXpert.exe file version once on mount
  const { data: versionData } = useQuery<{ version: string }>({
    queryKey: ["/api/version"],
    staleTime: Infinity,
  });

  // Keep a ref to the latest maxRows so interval callbacks always see the current value
  const maxRowsRef = useRef(maxRows);
  useEffect(() => { maxRowsRef.current = maxRows; }, [maxRows]);

  const fetchResources = useCallback(async () => {
    try {
      const res  = await apiRequest("POST", "/api/run/resources", {});
      const data = await res.json();
      const raw  = data.output as string;
      if (raw.includes("NOT running")) {
        setNotRunning(true);
        return;
      }
      setNotRunning(false);
      const parsed = parseResourceOutput(raw);
      if (parsed?.active) {
        setResRows(prev => [...prev, parsed.row].slice(-maxRowsRef.current));
        setTimeout(() => tableBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      }
    } catch {}
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const res  = await apiRequest("POST", "/api/run/logs", { maxLines: maxRowsRef.current });
      const data = await res.json();
      // Strip leading date (YYYY-MM-DD or YYYY/MM/DD) from each line
      const lines = (data.output as string)
        .split("\n")
        .map(l => l.replace(/^(\d{4}[-\/]\d{2}[-\/]\d{2}[T ]|\d{1,2}\/\d{1,2}\/\d{2,4}\s)/, ""))
        .join("\n");
      setLogsOutput(lines);
    } catch {}
  }, []);

  const stopMonitor = useCallback(() => {
    setMonitorActive(false);
    setResStatus("stopped");
    if (monitorResRef.current)  { clearInterval(monitorResRef.current);  monitorResRef.current  = null; }
    if (monitorLogsRef.current) { clearInterval(monitorLogsRef.current); monitorLogsRef.current = null; }
    if (autoStopRef.current)    { clearTimeout(autoStopRef.current);     autoStopRef.current    = null; }
  }, []);

  useEffect(() => {
    if (monitorActive) {
      setResStatus("running");
      fetchResources();
      fetchLogs();
      const ms = refreshInterval * 1000;
      monitorResRef.current  = setInterval(fetchResources, ms);
      monitorLogsRef.current = setInterval(fetchLogs,      ms);
      autoStopRef.current = setTimeout(() => {
        stopMonitor();
        toast({ title: "Monitor auto-stopped", description: `${autoStopMin}-minute session complete.` });
      }, autoStopMin * 60 * 1000);
    }
    return () => {
      if (monitorResRef.current)  clearInterval(monitorResRef.current);
      if (monitorLogsRef.current) clearInterval(monitorLogsRef.current);
      if (autoStopRef.current)    clearTimeout(autoStopRef.current);
    };
  }, [monitorActive, refreshInterval, autoStopMin]);

  function startMonitor() {
    setActiveSection("monitor");
    setResRows([]);
    setNotRunning(false);
    setResStatus("idle");
    setMonitorActive(true);
  }

  // Elapsed time display
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (monitorActive) {
      setElapsed(0);
      elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [monitorActive]);

  const remaining = Math.max(0, autoStopMin * 60 - elapsed);
  const remainingStr = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen h-screen bg-background text-foreground flex flex-col overflow-hidden" data-theme={theme}>
      {/* Header */}
      <header className="border-b border-border px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none" className="text-primary">
            <rect width="32" height="32" rx="8" fill="currentColor" fillOpacity="0.12" />
            <path d="M8 10h8a4 4 0 0 1 0 8H8v4h9a8 8 0 0 0 0-16H8v4z" fill="currentColor" />
            <circle cx="24" cy="22" r="3" fill="currentColor" fillOpacity="0.6" />
          </svg>
          <div>
            <h1 className="text-base font-semibold leading-tight">3DXpert Monitor</h1>
            <p className="text-xs text-muted-foreground">Oqton toolbox</p>
          </div>
        </div>
        <button onClick={toggleTheme} className="p-2 rounded-md hover:bg-accent transition-colors">
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-row gap-4 p-4 w-full overflow-hidden min-h-0">

        {/* Sidebar */}
        <aside className="flex flex-col gap-3 w-56 shrink-0">

          {/* Monitor card */}
          <div className={`rounded-xl border p-4 transition-colors ${activeSection === "monitor" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary mt-0.5"><Activity size={16} /></div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm leading-tight">Monitor</p>

              </div>
            </div>
            {monitorActive && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-green-600 animate-pulse">● live</span>
                <span className="text-xs text-muted-foreground ml-auto">{remainingStr} left</span>
              </div>
            )}

            {/* 3DXpert.exe file version */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">3DXpert version</span>
              <span className="text-xs font-mono font-medium text-foreground">
                {versionData ? versionData.version : "…"}
              </span>
            </div>

            {/* Refresh interval picker */}
            <div className="mt-3">
              <p className={`text-xs mb-1 ${monitorActive ? "text-muted-foreground/40" : "text-muted-foreground"}`}>Refresh interval</p>
              <div className="flex gap-1">
                {INTERVAL_OPTIONS.map(s => (
                  <button key={s} onClick={() => !monitorActive && setRefreshInterval(s)} disabled={monitorActive}
                    className={`flex-1 text-xs rounded px-1 py-0.5 border transition-colors cursor-${ monitorActive ? "not-allowed" : "pointer" } ${
                      refreshInterval === s
                        ? monitorActive
                          ? "border-primary/40 bg-primary/5 text-primary/40 font-medium"
                          : "border-primary bg-primary/10 text-primary font-medium"
                        : monitorActive
                          ? "border-border/30 bg-background/30 text-muted-foreground/20"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}>{s}s</button>
                ))}
              </div>
            </div>

            {/* Auto-stop picker */}
            <div className="mt-2">
              <p className={`text-xs mb-1 ${monitorActive ? "text-muted-foreground/40" : "text-muted-foreground"}`}>Auto-stop after</p>
              <div className="flex gap-1">
                {AUTOSTOP_OPTIONS.map(m => (
                  <button key={m} onClick={() => !monitorActive && setAutoStopMin(m)} disabled={monitorActive}
                    className={`flex-1 text-xs rounded px-1 py-0.5 border transition-colors cursor-${ monitorActive ? "not-allowed" : "pointer" } ${
                      autoStopMin === m
                        ? monitorActive
                          ? "border-primary/40 bg-primary/5 text-primary/40 font-medium"
                          : "border-primary bg-primary/10 text-primary font-medium"
                        : monitorActive
                          ? "border-border/30 bg-background/30 text-muted-foreground/20"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}>{m}m</button>
                ))}
              </div>
            </div>

            {/* Max rows picker */}
            <div className="mt-2">
              <p className={`text-xs mb-1 ${monitorActive ? "text-muted-foreground/40" : "text-muted-foreground"}`}>Max rows shown</p>
              <div className="flex gap-1">
                {MAX_ROWS_OPTIONS.map(r => (
                  <button key={r} onClick={() => !monitorActive && setMaxRows(r)} disabled={monitorActive}
                    className={`flex-1 text-xs rounded px-1 py-0.5 border transition-colors cursor-${ monitorActive ? "not-allowed" : "pointer" } ${
                      maxRows === r
                        ? monitorActive
                          ? "border-primary/40 bg-primary/5 text-primary/40 font-medium"
                          : "border-primary bg-primary/10 text-primary font-medium"
                        : monitorActive
                          ? "border-border/30 bg-background/30 text-muted-foreground/20"
                          : "border-border bg-background text-muted-foreground hover:border-primary/50"
                    }`}>{r}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <Button className="flex-1 text-sm" size="sm" onClick={monitorActive ? stopMonitor : startMonitor} data-testid="button-run-monitor">
                {monitorActive ? <><Square size={12} className="mr-1.5 fill-current" />Stop</> : <><Play size={12} className="mr-1.5" />Start</>}
              </Button>
              {resRows.length > 0 && !monitorActive && (
                <Button size="sm" variant="outline" className="px-2" onClick={() => { setResRows([]); setResStatus("idle"); setLogsOutput(""); }} title="Clear data">
                  <Trash2 size={13} />
                </Button>
              )}
            </div>
          </div>

          {/* Folder shortcuts frame */}
          <div className="rounded-lg border border-border p-2 flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground font-medium mb-0.5">Open folder</p>
            <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2 h-7"
              onClick={() => apiRequest("POST", "/api/open-dumps", {})} data-testid="button-open-dumps">
              <FolderOpen size={13} />DUMP
            </Button>
            <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2 h-7"
              onClick={() => apiRequest("POST", "/api/open-data", {})} data-testid="button-open-data">
              <FolderOpen size={13} />DATA
            </Button>
            <Button variant="outline" size="sm" className="w-full text-xs justify-start gap-2 h-7"
              onClick={() => apiRequest("POST", "/api/open-program", {})} data-testid="button-open-program">
              <FolderOpen size={13} />PROGRAM
            </Button>
          </div>

          {/* Exit */}
          <Button
            variant="destructive"
            size="sm"
            className="w-full text-sm justify-start gap-2"
            onClick={async () => {
              try { await apiRequest("POST", "/api/exit", {}); } catch {}
              window.close();
            }}
            data-testid="button-end-monitoring"
          >
            <PowerOff size={14} />
            Exit
          </Button>

          {/* History */}
          <div className="mt-auto">
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShowHistory(v => !v)} data-testid="button-toggle-history">
              <Clock size={11} />History{showHistory ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
            {showHistory && (
              <div className="mt-2 rounded-xl border border-border bg-card overflow-hidden max-h-40 overflow-y-auto">
                {history.length === 0 ? <p className="text-xs text-muted-foreground p-3 text-center">No runs yet</p> : (
                  <div className="divide-y divide-border">
                    {history.map(run => (
                      <div key={run.id} className="px-3 py-1.5 flex items-center gap-2 text-xs">
                        {run.exitCode === 0 ? <CheckCircle2 size={10} className="text-green-500 shrink-0" /> : <XCircle size={10} className="text-red-500 shrink-0" />}
                        <span className="font-medium capitalize shrink-0">{run.scriptName}</span>
                        <span className="text-muted-foreground shrink-0">{new Date(run.ranAt).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Output panels */}
        <section className="flex-1 flex flex-col gap-4 min-w-0 min-h-0 overflow-hidden">
          {/* Monitor: resources table + logs */}
            <div className="flex-1 flex flex-col gap-4 min-h-0">

              {/* Left = Logs, Right = Resources table — resizable split */}
              <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0" style={{ minHeight: 0 }}>

                {/* LEFT: Log pane */}
                <ResizablePanel defaultSize={50} minSize={20} className="flex flex-col min-h-0 pr-2">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={13} className="text-primary shrink-0" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Log Reader</p>
                    {monitorActive && <span className="text-xs text-green-600 animate-pulse ml-1">● live</span>}
                  </div>
                  <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden flex flex-col min-h-0">
                    {logsOutput ? (
                      <div className="flex-1 overflow-y-scroll p-3 scrollbar-thin">
                        <pre className="font-mono text-xs whitespace-pre leading-5">{logsOutput}</pre>
                      </div>
                    ) : (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">Click Start to tail the log</div>
                    )}
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle />

                {/* RIGHT: Resources table + trend charts */}
                <ResizablePanel defaultSize={35} minSize={15} className="flex flex-col min-h-0 pl-2 overflow-y-auto">
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu size={13} className="text-primary shrink-0" />
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Resources</p>
                    {monitorActive && <span className="text-xs text-green-600 animate-pulse ml-1">● live</span>}

                  </div>

                  {/* Table */}
                  <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden flex flex-col min-h-0">
                    {notRunning ? (
                      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">3DXpert.exe is not running</div>
                    ) : resRows.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2"><Activity size={20} className="opacity-30" /><p className="text-sm">Click Start to begin monitoring</p></div>
                    ) : (
                      <div className="flex-1 overflow-y-scroll overflow-x-auto scrollbar-thin">
                        <table className="w-max text-xs font-mono">
                          <thead className="sticky top-0 bg-card border-b border-border">
                            <tr>
                              {["Time", "Commit", "GDI Objects", "GPU Mem"].map(h => (
                                <th key={h} className="text-left px-3 py-1 text-muted-foreground font-medium whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {resRows.map((row, i) => (
                              <tr key={i}>
                                <td className="px-3 py-0 leading-5 whitespace-nowrap">
                                  <span className="flex items-center gap-1.5">
                                    <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${row.cpuActive ? "bg-green-500" : "bg-muted-foreground/20"}`} />
                                    <span className="text-muted-foreground">{row.time}</span>
                                  </span>
                                </td>
                                <td className="px-3 py-0 leading-5 whitespace-nowrap">{row.commit}</td>
                                <td className="px-3 py-0 leading-5 whitespace-nowrap">{row.gdi}</td>
                                <td className="px-3 py-0 leading-5 whitespace-nowrap">{row.gpu}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <div ref={tableBottomRef} />
                      </div>
                    )}
                  </div>

                  {/* Trend charts — shown once ≥2 samples exist */}
                  {resRows.length >= 2 && (
                    <TrendCharts resRows={resRows} />
                  )}
                </ResizablePanel>

              </ResizablePanelGroup>

            </div>
        </section>
      </main>
    </div>
  );
}

// ── Trend charts panel ───────────────────────────────────────────────────────
function TrendCharts({ resRows }: { resRows: ResourceRow[] }) {
  const window60 = resRows.slice(-CHART_WINDOW);

  const commitVals = useMemo(() => window60.map(r => toNum(r.commit)).filter(v => !isNaN(v)), [window60]);
  const gdiVals    = useMemo(() => window60.map(r => toNum(r.gdi)).filter(v => !isNaN(v)),    [window60]);
  const gpuVals    = useMemo(() => window60.map(r => toNum(r.gpu)).filter(v => !isNaN(v)),    [window60]);

  // Compute human-readable last values for labels
  const lastCommit = commitVals.at(-1);
  const lastGdi    = gdiVals.at(-1);
  const lastGpu    = gpuVals.at(-1);

  return (
    <div className="mt-2 rounded-xl border border-border bg-card px-3 pt-2 pb-2 shrink-0">
      <p className="text-xs text-muted-foreground font-medium mb-1.5 uppercase tracking-wide">Trend · last {Math.min(resRows.length, CHART_WINDOW)} samples</p>
      <div className="flex flex-col gap-2">

        {/* Commit */}
        {commitVals.length >= 2 && (
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-muted-foreground font-mono">Commit</span>
              {lastCommit !== undefined && (
                <span className="text-[10px] font-mono" style={{ color: "#60a5fa" }}>{lastCommit.toLocaleString()}</span>
              )}
            </div>
            <SparkChart series={[{ label: "Commit", color: "#60a5fa", values: commitVals }]} height={52} />
          </div>
        )}

        {/* GDI */}
        {gdiVals.length >= 2 && (
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-muted-foreground font-mono">GDI Objects</span>
              {lastGdi !== undefined && (
                <span className="text-[10px] font-mono" style={{ color: "#34d399" }}>{lastGdi.toLocaleString()}</span>
              )}
            </div>
            <SparkChart series={[{ label: "GDI", color: "#34d399", values: gdiVals }]} height={52} />
          </div>
        )}

        {/* GPU Mem */}
        {gpuVals.length >= 2 && (
          <div>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-muted-foreground font-mono">GPU Mem (kB)</span>
              {lastGpu !== undefined && (
                <span className="text-[10px] font-mono" style={{ color: "#f97316" }}>{lastGpu.toLocaleString()}</span>
              )}
            </div>
            <SparkChart series={[{ label: "GPU Mem", color: "#f97316", values: gpuVals }]} height={52} />
          </div>
        )}

      </div>
    </div>
  );
}
