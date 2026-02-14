/**
 * File-based logger for pi-superpowers-plus.
 *
 * Default singleton writes to ~/.pi/logs/superpowers-plus.log.
 * Info/warn/error always write. Debug writes only when PI_SUPERPOWERS_DEBUG=1.
 * One-deep rotation when file exceeds 5 MB.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export interface LoggerOptions {
  verbose?: boolean;
  maxSizeBytes?: number;
}

export interface Logger {
  info(message: string): void;
  warn(message: string): void;
  error(message: string, err?: unknown): void;
  debug(message: string): void;
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024; // 5 MB

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ?? `${err.name}: ${err.message}`;
  }
  return String(err);
}

function timestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "");
}

export function createLogger(logPath: string, options?: LoggerOptions): Logger {
  const verbose = options?.verbose ?? false;
  const maxSizeBytes = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE;
  let rotatedThisSession = false;

  function ensureDir(): void {
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  function rotateIfNeeded(): void {
    if (rotatedThisSession) return;
    try {
      const stat = fs.statSync(logPath);
      if (stat.size > maxSizeBytes) {
        fs.renameSync(logPath, logPath + ".1");
      }
    } catch {
      // File doesn't exist yet — nothing to rotate
    }
    rotatedThisSession = true;
  }

  function write(level: string, message: string): void {
    try {
      ensureDir();
      rotateIfNeeded();
      const line = `${timestamp()} [${level}] ${message}\n`;
      fs.appendFileSync(logPath, line, "utf-8");
    } catch {
      // Logger must never crash the application
    }
  }

  return {
    info(message: string): void {
      write("INFO", message);
    },
    warn(message: string): void {
      write("WARN", message);
    },
    error(message: string, err?: unknown): void {
      const suffix = err ? ` — ${formatError(err)}` : "";
      write("ERROR", message + suffix);
    },
    debug(message: string): void {
      if (!verbose) return;
      write("DEBUG", message);
    },
  };
}

/** Default singleton logger used across all extensions. */
const LOG_PATH = path.join(os.homedir(), ".pi", "logs", "superpowers-plus.log");

export const log: Logger = createLogger(LOG_PATH, {
  verbose: process.env.PI_SUPERPOWERS_DEBUG === "1",
});
