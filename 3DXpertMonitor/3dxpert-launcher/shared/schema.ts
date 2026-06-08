// Shared types — no native DB dependency
export interface ScriptRun {
  id: number;
  scriptName: string;
  output: string;
  exitCode: number;
  ranAt: string;
}
