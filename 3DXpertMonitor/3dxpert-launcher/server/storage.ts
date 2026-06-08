import fs from "fs";
import path from "path";

// Pure JSON file storage — no native addons, works on any Windows machine
const DB_FILE = path.join(process.cwd(), "runs.json");

export interface ScriptRun {
  id: number;
  scriptName: string;
  output: string;
  exitCode: number;
  ranAt: string;
}

function loadRuns(): ScriptRun[] {
  try {
    if (!fs.existsSync(DB_FILE)) return [];
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveRuns(runs: ScriptRun[]) {
  fs.writeFileSync(DB_FILE, JSON.stringify(runs, null, 2), "utf-8");
}

export interface IStorage {
  saveRun(run: Omit<ScriptRun, "id">): ScriptRun;
  getRecentRuns(limit?: number): ScriptRun[];
}

export class Storage implements IStorage {
  saveRun(run: Omit<ScriptRun, "id">): ScriptRun {
    const runs = loadRuns();
    const newRun: ScriptRun = { id: Date.now(), ...run };
    runs.push(newRun);
    // Keep only last 100
    const trimmed = runs.slice(-100);
    saveRuns(trimmed);
    return newRun;
  }

  getRecentRuns(limit = 20): ScriptRun[] {
    return loadRuns().reverse().slice(0, limit);
  }
}

export const storage = new Storage();
